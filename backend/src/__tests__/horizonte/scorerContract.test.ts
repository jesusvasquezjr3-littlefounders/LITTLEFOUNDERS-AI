import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { hzBase, hzServer, hzVisual } from '../../services/horizonte/shared.js';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import type { HorizonteFixture, HorizontePack, HorizonteScorer } from '../../services/horizonte/types.js';

const TYPE = 'math.sample-pick.v2';
const segment = z.object({ ...hzBase, type: z.literal(TYPE), grading: hzServer, visual: hzVisual('sample-pick'), payload: z.object({ options: z.array(z.number().int()).min(2).max(4) }).strict() }).strict();

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };

const goodGrade: Grade = (seg, response, rubric) => {
  const options = (seg as { payload: { options: number[] } }).payload.options;
  const pick = (response as { pick?: unknown } | null)?.pick;
  if (typeof response !== 'object' || response === null || Object.keys(response).join() !== 'pick' || typeof pick !== 'number' || !options.includes(pick)) return { verdict: 'invalid', diagnostic: 'none' };
  if (rubric === undefined) return { verdict: 'valid', diagnostic: 'none' };
  const answer = (rubric as { answer?: unknown }).answer;
  if (typeof answer !== 'number' || !options.includes(answer)) return { verdict: 'invalid', diagnostic: 'none' };
  if (pick === options[0]) return { verdict: 'valid', diagnostic: 'none' };
  return pick === answer ? { verdict: 'met', diagnostic: 'none' } : { verdict: 'review', diagnostic: 'value' };
};
const sampleOf = ((seg: { payload: { options: number[] } }) => ({ pick: seg.payload.options[0] })) as HorizonteScorer['sample'];
const scorerOf = (grade: Grade, sample = sampleOf): HorizonteScorer => ({ grade: grade as HorizonteScorer['grade'], sample });

const fixture: HorizonteFixture = {
  id: 'pick-two', title: { 'en-US': 'Pick', 'es-MX': 'Elige', 'pt-BR': 'Escolha' }, ageBand: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 },
  segment: (locale) => ({ id: 'sample-pick-one', type: TYPE, grading: 'server', visual: { type: 'sample-pick' }, prompt: { 'en-US': 'Pick the larger.', 'es-MX': 'Elige el mayor.', 'pt-BR': 'Escolha o maior.' }[locale], payload: { options: [3, 7] } }),
  rubric: { answer: 7 }, ladder: { invalid: { pick: 99 }, valid: { pick: 3 }, met: { pick: 7 } },
};

const pack = (over: Partial<HorizontePack> = {}): HorizontePack => ({
  id: 'sample', segments: [segment], capabilities: { [TYPE]: ['visual.sample-pick.v1'] },
  rubrics: { [TYPE]: z.object({ answer: z.number().int() }).strict() }, ageScope: { [TYPE]: { ages: [10, 12], adult: false } }, scorers: { [TYPE]: scorerOf(goodGrade) }, ...over,
});

describe('assertScorerContract', () => {
  it('accepts a pure, total scorer with a reachable ladder, a scorable sample and a declared age scope', () => {
    expect(() => assertScorerContract(pack(), [fixture])).not.toThrow();
  });

  it('rejects an undeclared age scope', () => {
    expect(() => assertScorerContract(pack({ ageScope: {} }), [fixture])).toThrow(/no age scope declared/);
  });

  it('rejects a scorer that mutates its input', () => {
    const mutating: Grade = (seg, response, rubric) => { (seg as { payload: { options: number[] } }).payload.options.push(1); return goodGrade(seg, response, rubric); };
    expect(() => assertScorerContract(pack({ scorers: { [TYPE]: scorerOf(mutating) } }), [fixture])).toThrow(/threw/);
  });

  it('rejects a scorer that is not deterministic', () => {
    let calls = 0;
    const flaky: Grade = (seg, response, rubric) => {
      const graded = goodGrade(seg, response, rubric);
      calls += 1;
      return graded.verdict === 'met' && calls % 2 === 0 ? { verdict: 'met', diagnostic: 'value' } : graded;
    };
    expect(() => assertScorerContract(pack({ scorers: { [TYPE]: scorerOf(flaky) } }), [fixture])).toThrow(/deterministic|diagnostic/);
  });

  it('rejects a ladder whose rungs are not reachable', () => {
    const wrong = { ...fixture, ladder: { ...fixture.ladder, met: { pick: 3 } } };
    expect(() => assertScorerContract(pack(), [wrong])).toThrow(/ladder.met must score met/);
  });

  it('rejects an advisory verdict that can be met without a rubric', () => {
    const lax: Grade = (seg, response) => ({ verdict: (response as { pick: number }).pick === 7 ? 'met' : 'valid', diagnostic: 'none' });
    expect(() => assertScorerContract(pack({ scorers: { [TYPE]: scorerOf(lax) } }), [fixture])).toThrow();
  });

  it('rejects a sample response that is not scorable', () => {
    const bad = scorerOf(goodGrade, (() => ({ nope: true })) as HorizonteScorer['sample']);
    expect(() => assertScorerContract(pack({ scorers: { [TYPE]: bad } }), [fixture])).toThrow(/sample response must be scorable/);
  });

  it('rejects a rubric field that also sits in the public payload', () => {
    const leaky = { ...fixture, rubric: { answer: 7, options: [3, 7] } };
    expect(() => assertScorerContract(pack({ rubrics: { [TYPE]: z.object({ answer: z.number().int(), options: z.array(z.number()) }).strict() } }), [leaky])).toThrow(/also sits in the public payload/);
  });

  it('rejects a type with no fixture', () => {
    expect(() => assertScorerContract(pack(), [])).toThrow(/no fixture/);
  });
});
