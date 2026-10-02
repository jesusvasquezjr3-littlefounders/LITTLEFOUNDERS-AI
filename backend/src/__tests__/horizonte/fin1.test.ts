import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { fin1 } from '../../services/horizonte/fin1/index.js';
import { FIN1_FIXTURES } from '../../services/horizonte/fin1/fixtures.js';
import { FIN1_CAPABILITIES } from '../../services/horizonte/fin1/capabilities.js';
import { COMPOUND_TYPE, RATE_RETURN_TYPE, TIME_VALUE_TYPE } from '../../services/horizonte/fin1/contract.js';
import {
  annuityPresentCents, bestOrder, cardRows, cardSchedule, centsText, compoundCents, discountedCents, divRound, doublingYearsTenths, effectiveAnnualBps,
  flowsOf, futureValueCents, growthRows, irrBps, keySolutionSound, meetsChallenge, nearestOption, normalizeDecimal, npvAtBps, npvCents, paymentWorth, periodBalanceCents,
  predictionHint, presentValueCents, rateRange, rateTarget, simpleCents, tableYears, timeValueFrame, timeValueTarget, type TimeValuePayload,
} from '../../services/horizonte/fin1/model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = (type: string): Grade => fin1.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => FIN1_FIXTURES.find((item) => item.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const run = (id: string, response: unknown, ...key: unknown[]) => grade(String(segmentOf(id).type))(segmentOf(id), response, key.length > 0 ? key[0] : fixture(id).rubric);

function lesson(item: (typeof FIN1_FIXTURES)[number], locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const type = String(item.segment('en-US').type) as keyof typeof FIN1_CAPABILITIES;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-fin1', chapter_id: 'horizonte-fin1', lesson_id: `hz-fin1-${item.id}`,
    version_id: 'rev-1', locale, age_band: item.ageBand, eligibility: item.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: item.title[locale], required_capabilities: [...FIN1_CAPABILITIES[type]], segments: [item.segment(locale)],
  };
}

describe('fin1 pack: the finance model (golden values)', () => {
  it('rounds half up toward +infinity, exactly', () => {
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(-5n, 2n)).toBe(-2n);
    expect(divRound(7n, 3n)).toBe(2n);
    expect(divRound(-7n, 3n)).toBe(-2n);
    expect(centsText(267301)).toBe('2673.01');
    expect(centsText(-5)).toBe('-0.05');
    expect(normalizeDecimal('26.80')).toBe('26.8');
    expect(normalizeDecimal('131')).toBe('131');
  });

  it('F1.10: compound against simple interest, to the cent', () => {
    expect(compoundCents(100_000, 7, 30)).toBe(761_226);
    expect(simpleCents(100_000, 7, 30)).toBe(310_000);
    const rows = growthRows(100_000, 7, 30)!;
    expect(rows).toHaveLength(31);
    expect([10, 20, 30].map((year) => [rows[year]!.compoundCents, rows[year]!.simpleCents])).toEqual([[196_715, 170_000], [386_968, 240_000], [761_226, 310_000]]);
    expect(rows[0]).toEqual({ year: 0, compoundCents: 100_000, simpleCents: 100_000 });
    expect(growthRows(99, 7, 30)).toBeNull();
    expect(growthRows(100_000, 13, 30)).toBeNull();
    expect(growthRows(100_000, 7, 41)).toBeNull();
    expect(growthRows(100_000, 7.5, 3)).toBeNull();
    expect(doublingYearsTenths(7)).toBe(103);
    expect(tableYears(30)).toEqual([0, 10, 20, 30]);
    expect(tableYears(8)).toEqual([0, 2, 4, 6, 8]);
    expect(tableYears(15)).toEqual([0, 5, 10, 15]);
  });

  it('F1.10: the prediction key, the hints and the challenge', () => {
    const options = [{ id: 'opt-a', cents: 310_000 }, { id: 'opt-b', cents: 500_000 }, { id: 'opt-c', cents: 760_000 }, { id: 'opt-d', cents: 1_200_000 }];
    expect(nearestOption(options, 761_226)).toBe('opt-c');
    expect(nearestOption([{ id: 'opt-a', cents: 100 }, { id: 'opt-b', cents: 300 }], 200)).toBeNull();
    expect(['opt-a', 'opt-b', 'opt-c', 'opt-d'].map((id) => predictionHint(options, id, 761_226, 310_000))).toEqual(['simple', 'short', 'right', 'over']);
    const challenge = { minimumCents: 200_000, maximumYears: 12 };
    expect(meetsChallenge(100_000, challenge, 6, 12)).toBe(true);
    expect(meetsChallenge(100_000, challenge, 5, 12)).toBe(false);
    expect(meetsChallenge(100_000, challenge, 7, 30)).toBe(false);
  });

  it('F2.11: present and future value, annuities and the best order', () => {
    const flows = [{ year: 1, cents: 100_000 }, { year: 2, cents: 100_000 }, { year: 3, cents: 100_000 }];
    expect(presentValueCents(flows, 600)).toBe(267_301);
    expect(futureValueCents(flows, 600, 3)).toBe(318_360);
    expect(presentValueCents([{ year: 3, cents: 100_000 }], 600)).toBe(83_962);
    expect(annuityPresentCents(100_000, 600, 3, 'end')).toBe(267_301);
    expect(annuityPresentCents(100_000, 600, 3, 'start')).toBe(283_339);
    expect(paymentWorth({ year: 3, cents: 100_000 }, 600, 3, 'present')).toBe(83_962);
    const order = (fixture('receive-three').segment('en-US').payload as TimeValuePayload);
    const frame = timeValueFrame(order);
    expect(frame.pieceIds).toEqual(['pay-1', 'pay-2', 'pay-3']);
    expect(bestOrder(order)).toEqual({ 'year-1': ['pay-3'], 'year-2': ['pay-2'], 'year-3': ['pay-1'] });
    expect(timeValueTarget(order, bestOrder(order)!)).toBe('5449.80');
    expect(timeValueTarget(order, frame.start)).toBe('5242.25');
    expect(flowsOf(frame, { 'year-9': ['pay-1'] })).toBeNull();
    expect(keySolutionSound(order, bestOrder(order)!)).toBe(true);
    expect(keySolutionSound(order, frame.start)).toBe(false);
    const paying = fixture('pay-four').segment('en-US').payload as TimeValuePayload;
    expect(timeValueTarget(paying, bestOrder(paying)!)).toBe('5416.26');
    const due = fixture('annuity-start').segment('en-US').payload as TimeValuePayload;
    expect(timeValueTarget(due, { 'year-0': ['payment'], 'year-1': ['payment'], 'year-2': ['payment'] })).toBe('3374.62');
    expect(keySolutionSound(due, { 'year-1': ['payment'], 'year-2': ['payment'], 'year-3': ['payment'] })).toBe(false);
  });

  it('F2.12: effective annual rate, card payoff, NPV and IRR', () => {
    expect(effectiveAnnualBps(2400, 12)).toBe(2682);
    expect(effectiveAnnualBps(1200, 1)).toBe(1200);
    expect(effectiveAnnualBps(1200, 365)).toBe(1275);
    expect(effectiveAnnualBps(1000, 2)).toBe(1025);
    expect(effectiveAnnualBps(1000, 7)).toBeNull();
    expect(periodBalanceCents(10_000, 2400, 12, 0)).toBe(10_000);
    expect(periodBalanceCents(10_000, 2400, 12, 1)).toBe(10_200);
    expect(periodBalanceCents(10_000, 2400, 12, 12)).toBe(12_682);
    expect(periodBalanceCents(10_000, 2400, 12, 13)).toBeNull();
    expect(cardSchedule({ balanceCents: 200_000, aprBps: 1800, minimumPctBps: 100, floorCents: 2500 })).toEqual({ months: 131, interestCents: 203_869, paidCents: 403_869 });
    expect(cardSchedule({ balanceCents: 500_000, aprBps: 2400, minimumPctBps: 100, floorCents: 2500 })).toMatchObject({ months: 234, interestCents: 888_694 });
    const rows = cardRows({ balanceCents: 200_000, aprBps: 1800, minimumPctBps: 100, floorCents: 2500 })!;
    expect(rows[0]).toEqual({ month: 0, balanceCents: 200_000, interestPaidCents: 0, paidCents: 0 });
    expect(rows.at(-1)).toMatchObject({ month: 131, balanceCents: 0 });
    expect(rows[1]).toMatchObject({ balanceCents: 200_000 + 3000 - 5000, interestPaidCents: 3000, paidCents: 5000 });
    expect(npvCents(1000, 1_000_000, [400_000, 500_000, 600_000])).toBe(227_648);
    expect(npvAtBps(2165, 1_000_000, [400_000, 500_000, 600_000])).toBe(-36);
    expect(npvAtBps(2166, 1_000_000, [400_000, 500_000, 600_000])!).toBeLessThan(0);
    expect(discountedCents(1000, 1, 400_000)).toBe(363_636);
    expect(irrBps(1_000_000, [400_000, 500_000, 600_000])).toBe(2165);
    expect(irrBps(100_000, [60_000, 60_000])).toBe(1307);
    expect(irrBps(100_000, [110_000, 0])).toBe(1000);
    expect(irrBps(100_000, [50_000, 40_000])).toBeNull();
    expect(irrBps(100_000, [1_000_000, 1_000_000])).toBeNull();
  });

  it('F2.12: the answer text and range per kind', () => {
    expect(rateTarget({ kind: 'effective', nominalBps: 2400, periodsPerYear: 12 })).toBe('26.82');
    expect(rateTarget({ kind: 'card', ask: 'months', balanceCents: 200_000, aprBps: 1800, minimumPctBps: 100, floorCents: 2500 })).toBe('131');
    expect(rateTarget({ kind: 'card', ask: 'interest', balanceCents: 200_000, aprBps: 1800, minimumPctBps: 100, floorCents: 2500 })).toBe('2038.69');
    expect(rateTarget({ kind: 'npv', rateBps: 1000, outlayCents: 1_000_000, flowsCents: [400_000, 500_000, 600_000] })).toBe('2276.48');
    expect(rateTarget({ kind: 'irr', outlayCents: 1_000_000, flowsCents: [400_000, 500_000, 600_000] })).toBe('21.65');
    expect(rateRange({ kind: 'irr', outlayCents: 1, flowsCents: [] })).toEqual({ minimum: '0', maximum: '100' });
  });
});

describe('fin1 pack: the scorers', () => {
  it('meets the scorer contract for every fixture', () => {
    expect(() => assertScorerContract(fin1, FIN1_FIXTURES)).not.toThrow();
  });

  it('declares the three segment types with their capabilities', () => {
    expect(Object.keys(fin1.capabilities)).toEqual([COMPOUND_TYPE, TIME_VALUE_TYPE, RATE_RETURN_TYPE]);
  });

  it('F1.10 marks the prediction, the sliders and the explanation', () => {
    const met = { predict: 'opt-c', rate: 6, years: 12, explain: 'interest-on-interest' };
    expect(run('compound-thirty', met)).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('compound-thirty', { ...met, predict: 'opt-a' })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('compound-thirty', { ...met, rate: 5 })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('compound-thirty', { ...met, explain: 'same-each-year' })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('compound-thirty', { ...met, predict: 'opt-a', explain: 'same-each-year' })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run('compound-thirty', { predict: 'opt-a', rate: 3, years: 4, explain: 'deposit-grows' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('compound-thirty', { predict: 'opt-c', rate: 7, years: 30 }).verdict).toBe('valid');
    expect(run('compound-thirty', { ...met, explain: 'rate-grows' }).verdict).toBe('invalid');
    expect(run('compound-thirty', { ...met, rate: 13 }).verdict).toBe('invalid');
    expect(run('compound-thirty', { ...met, years: 0 }).verdict).toBe('invalid');
    expect(run('compound-thirty', { ...met, rate: 6.5 }).verdict).toBe('invalid');
    expect(run('compound-thirty', { ...met, extra: 1 }).verdict).toBe('invalid');
  });

  it('F1.10 refuses a key that disagrees with the model, and never says met without a rubric', () => {
    const met = { predict: 'opt-c', rate: 6, years: 12, explain: 'interest-on-interest' };
    expect(run('compound-thirty', met, { predictOption: 'opt-b', explainId: 'interest-on-interest' }).verdict).toBe('invalid');
    expect(run('compound-thirty', met, { predictOption: 'opt-c', explainId: 'same-each-year' }).verdict).toBe('invalid');
    expect(run('compound-thirty', met, { predictOption: 'opt-c', explainId: 'interest-on-interest', extra: 1 }).verdict).toBe('invalid');
    expect(run('compound-thirty', met, undefined).verdict).toBe('valid');
  });

  it('F2.11 marks the arrangement and the number', () => {
    const best = { 'year-1': ['pay-3'], 'year-2': ['pay-2'], 'year-3': ['pay-1'] };
    const worst = { 'year-1': ['pay-1'], 'year-2': ['pay-2'], 'year-3': ['pay-3'] };
    expect(run('receive-three', { slots: best, value: '5449.80' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('receive-three', { slots: best, value: '5449.83' }).verdict).toBe('met');
    expect(run('receive-three', { slots: best, value: '5450.50' })).toEqual({ verdict: 'review', diagnostic: 'tolerance' });
    expect(run('receive-three', { slots: best, value: '6000' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    // The right number for the learner's own (wrong) arrangement still leaves the arrangement wrong.
    expect(run('receive-three', { slots: worst, value: '5242.25' })).toMatchObject({ verdict: 'review' });
    expect(run('receive-three', { slots: worst, value: '5242.25' }).diagnostic).not.toBe('none');
    expect(run('receive-three', { slots: worst, value: '1' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('receive-three', { slots: best })).toEqual({ verdict: 'valid', diagnostic: 'none' });
    expect(run('receive-three', { slots: best, value: '-1' }).verdict).toBe('invalid');
    expect(run('receive-three', { slots: { 'year-1': ['pay-3', 'pay-3'] } }).verdict).toBe('invalid');
    expect(run('receive-three', { slots: best, value: '5449.80', extra: 1 }).verdict).toBe('invalid');
    expect(run('annuity-end', { slots: { 'year-1': ['payment'], 'year-2': ['payment'], 'year-3': ['payment'] }, value: '2673.01' }).verdict).toBe('met');
    expect(run('annuity-end', { slots: { 'year-0': ['payment'], 'year-1': ['payment'], 'year-2': ['payment'] }, value: '2833.39' }).verdict).toBe('review');
    expect(run('annuity-end', { slots: { 'year-1': ['payment'], 'year-2': ['payment'] }, value: '1833.39' }).diagnostic).toBe('miss');
    expect(run('annuity-end', { slots: { 'year-1': ['payment'], 'year-2': ['payment'], 'year-3': ['payment'], 'year-0': ['payment'] }, value: '3673.01' }).diagnostic).toBe('false_alarm');
  });

  it('F2.11 refuses a key that is not the best order', () => {
    const best = { 'year-1': ['pay-3'], 'year-2': ['pay-2'], 'year-3': ['pay-1'] };
    const wrongKey = { solutions: [{ 'year-1': ['pay-1'], 'year-2': ['pay-2'], 'year-3': ['pay-3'] }], tolerance: { absolute: '0.05' } };
    expect(run('receive-three', { slots: best, value: '5449.80' }, wrongKey).verdict).toBe('invalid');
    expect(run('receive-three', { slots: best, value: '5449.80' }, { ...wrongKey, solutions: [best], tolerance: { absolute: '5' }, review: { absolute: '1' } }).verdict).toBe('invalid');
    expect(run('receive-three', { slots: best, value: '5449.80' }, { solutions: [] , tolerance: { absolute: '0.05' } }).verdict).toBe('invalid');
    expect(run('annuity-end', { slots: { 'year-1': ['payment'] }, value: '942.45' }, { solutions: [{ 'year-0': ['payment'], 'year-1': ['payment'], 'year-2': ['payment'] }], tolerance: { absolute: '0.05' } }).verdict).toBe('invalid');
    expect(run('receive-three', { slots: best, value: '5449.80' }, undefined).verdict).toBe('valid');
  });

  it('F2.12 grades the typed number once it is final', () => {
    expect(run('effective-monthly', { value: '26.82', final: true })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('effective-monthly', { value: '26.8', final: true }).verdict).toBe('met');
    expect(run('effective-monthly', { value: '27.5', final: true })).toEqual({ verdict: 'review', diagnostic: 'tolerance' });
    expect(run('effective-monthly', { value: '24', final: true })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('effective-monthly', { value: '24' })).toEqual({ verdict: 'valid', diagnostic: 'none' });
    expect(run('effective-monthly', { value: '26.82', final: false }).verdict).toBe('valid');
    expect(run('effective-monthly', { value: '26.82', final: 'yes' }).verdict).toBe('invalid');
    expect(run('effective-monthly', { value: '1001', final: true }).verdict).toBe('invalid');
    expect(run('card-months', { value: '131', final: true }).verdict).toBe('met');
    expect(run('card-months', { value: '133', final: true })).toEqual({ verdict: 'review', diagnostic: 'tolerance' });
    expect(run('card-months', { value: '60', final: true })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('card-interest', { value: '8886.94', final: true }).verdict).toBe('met');
    expect(run('npv-project', { value: '2276.48', final: true }).verdict).toBe('met');
    expect(run('npv-project', { value: '-1000', final: true }).verdict).toBe('review');
    expect(run('irr-project', { value: '21.7', final: true }).verdict).toBe('met');
    expect(run('irr-project', { value: '22.4', final: true })).toEqual({ verdict: 'review', diagnostic: 'tolerance' });
  });

  it('F2.12 refuses a key that is not the model answer', () => {
    expect(run('effective-monthly', { value: '24', final: true }, { target: '24', tolerance: { absolute: '0.05' } }).verdict).toBe('invalid');
    expect(run('effective-monthly', { value: '26.82', final: true }, { target: '26.82', tolerance: { absolute: '0.05' }, review: { absolute: '0.01' } }).verdict).toBe('invalid');
    expect(run('effective-monthly', { value: '26.82', final: true }, { target: '26.820', tolerance: { absolute: '0.05' } }).verdict).toBe('met');
    expect(run('effective-monthly', { value: '26.82', final: true }, undefined).verdict).toBe('valid');
    expect(run('irr-project', { value: '21.65', final: true }, { target: '21.65', tolerance: { absolute: '0.1' }, unknown: 1 }).verdict).toBe('invalid');
  });

  it('refuses a payload outside the model and a wrong visual', () => {
    const bad = (id: string, payload: unknown) => grade(String(segmentOf(id).type))({ ...segmentOf(id), payload }, fixture(id).ladder.met, fixture(id).rubric).verdict;
    expect(bad('card-months', { kind: 'card', ask: 'months', balanceCents: 2_000_000, aprBps: 500, minimumPctBps: 100, floorCents: 1000 })).toBe('invalid');
    expect(bad('irr-project', { kind: 'irr', outlayCents: 1_000_000, flowsCents: [100_000, 100_000] })).toBe('invalid');
    expect(bad('receive-three', { rateBps: 600, ask: 'present', task: { kind: 'order', side: 'receive', amountsCents: [100_000, 100_000] } })).toBe('invalid');
    expect(bad('compound-thirty', { ...(segmentOf('compound-thirty').payload as object), challenge: { minimumCents: 100_000_000, maximumYears: 5 } })).toBe('invalid');
    expect(bad('compound-thirty', undefined)).toBe('invalid');
  });

  it('is open to the declared ages, and to adults', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope(COMPOUND_TYPE, '10-12', 10, 12)).toBeNull();
    expect(scope(COMPOUND_TYPE, '6-9', 6, 9)).not.toBeNull();
    expect(scope(COMPOUND_TYPE, 'adult', 18, 99)).toBeNull();
    expect(scope(TIME_VALUE_TYPE, '13-17', 14, 17)).toBeNull();
    expect(scope(TIME_VALUE_TYPE, '10-12', 10, 12)).not.toBeNull();
    expect(scope(TIME_VALUE_TYPE, '13-17', 13, 17)).not.toBeNull();
    expect(scope(RATE_RETURN_TYPE, '13-17', 15, 17)).toBeNull();
    expect(scope(RATE_RETURN_TYPE, '13-17', 14, 17)).not.toBeNull();
    expect(scope(RATE_RETURN_TYPE, 'adult', 18, 99)).toBeNull();
  });
});

describe('fin1 pack: Core plug-in', () => {
  it('parses every fixture in every locale through the public schema', () => {
    for (const item of FIN1_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(item, locale)).success, `${item.id} ${locale}`).toBe(true);
  });

  it('keeps the answer key private, checks it, and grades on the server', () => {
    for (const item of FIN1_FIXTURES) {
      const document = lesson(item);
      const id = item.segment('en-US').id as string;
      const keys = { [id]: item.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), item.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, item.ladder.met), item.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, item.ladder.valid), item.id).toBeNull();
      expect(horizonteSampleVerdict(item.segment('en-US') as { type: string }, item.rubric), item.id).not.toBe('invalid');
      expect(horizonteGrade({ type: String(item.segment('en-US').type) }, item.ladder.met, item.rubric), item.id).toBeNull();
    }
    const card = fixture('card-months');
    const document = lesson(card);
    expect(validateV2LessonForGrading(document, { 'card-months': { target: '99' } }, { lessonId: document.lesson_id, locale: document.locale })).toBeNull();
    expect(gradeV2Visual(v2PublicLessonSchema.parse(document), { 'card-months': card.rubric }, 'card-months', { value: '133', final: true })).toMatchObject({ score: 0, correct: false, diagnostic: 'tolerance' });
  });

  it('refuses a payload that leaks the answer, a wrong visual and an out-of-scope document', () => {
    const base = lesson(fixture('compound-thirty'));
    const patched = (change: object) => ({ ...base, segments: [{ ...base.segments[0], ...change }] });
    expect(v2PublicLessonSchema.safeParse(patched({ visual: { type: 'time-value' } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(patched({ payload: { ...(base.segments[0]!.payload as object), predictOption: 'opt-c' } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } }).success).toBe(false);
    const rate = lesson(fixture('irr-project'));
    expect(v2PublicLessonSchema.safeParse({ ...rate, segments: [{ ...rate.segments[0], visual: { type: 'effective-rate' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...rate, segments: [{ ...rate.segments[0], payload: { kind: 'irr', outlayCents: 1_000_000, flowsCents: [400_000, 500_000, 600_000], target: '21.65' } }] }).success).toBe(false);
    const time = lesson(fixture('receive-three'));
    expect(v2PublicLessonSchema.safeParse({ ...time, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } }).success).toBe(false);
  });
});
