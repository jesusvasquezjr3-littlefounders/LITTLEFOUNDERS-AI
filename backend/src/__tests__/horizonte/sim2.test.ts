import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { SAMPLE_ATTEMPT } from '../../services/horizonte/seed/protocol.js';
import { sim2 } from '../../services/horizonte/sim2/index.js';
import { SIM2_CAPABILITIES } from '../../services/horizonte/sim2/capabilities.js';
import { SIM2_FIXTURES } from '../../services/horizonte/sim2/fixtures.js';
import {
  ANSWER_RULE, CHAPTER_YEARS, FUTURES, GOAL_MAX, GOAL_MIN, MISS_TAIL, OUTCOMES, OUTCOME_TABLE, SOLVE_TAIL, advance, analyse, drawOutcomes, futuresOf, isChoices, isPayload, payloadProblem, reachChance,
  successCount, waysOf, worth, type Payload,
} from '../../services/horizonte/sim2/model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem, isSeededHorizonteType } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Attempt = { seed: string };
type Grade = (segment: unknown, response: unknown, rubric: unknown, attempt?: Attempt) => { verdict: string; diagnostic: string };
const grade = sim2.scorers['money.life-sim.v2']!.grade as unknown as Grade;
const fixture = (id: string) => SIM2_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const seedOf = (id: string) => fixture(id).seed as string;
const payloadOf = (id: string) => segmentOf(id).payload as Payload;
const verdictOf = (id: string, response: unknown, rubric: unknown = fixture(id).rubric, attempt: Attempt | undefined = { seed: seedOf(id) }) => grade(segmentOf(id), response, rubric, attempt).verdict;
const seedFor = (index: number) => createHash('sha256').update(`sim2-seed-${index}`).digest('hex');

function lesson(entry = SIM2_FIXTURES[0]!, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const segment = entry.segment(locale);
  const type = segment.type as keyof typeof SIM2_CAPABILITIES;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-sim', chapter_id: 'horizonte-sim2', lesson_id: `hz-sim2-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...SIM2_CAPABILITIES[type]], segments: [segment],
  };
}

const tiny = (patch: Partial<Payload>): Payload => ({ scenario: 'insurance', periods: 2, cash: 3000, debt: 0, flow: 3000, finish: 0, floor: 1000, goal: 60, choices: [0, 50, 100], start: 0, ...patch });

describe('sim2 pack: F3.3 live a year or twenty with compressed time', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(sim2, SIM2_FIXTURES)).not.toThrow();
  });

  it('declares its one segment type with fixtures for all four scenarios and a seeded run', () => {
    expect(Object.keys(SIM2_CAPABILITIES)).toEqual(['money.life-sim.v2']);
    expect(SIM2_CAPABILITIES['money.life-sim.v2']).toEqual(['visual.life-sim.v1', 'operation.seeded-run.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1']);
    expect(isSeededHorizonteType('money.life-sim.v2')).toBe(true);
    expect(SIM2_FIXTURES.map((entry) => (entry.segment('en-US').payload as Payload).scenario).sort()).toEqual(['insurance', 'life', 'portfolio', 'retirement']);
    for (const entry of SIM2_FIXTURES) expect(entry.seed, entry.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps the whole-number dynamics exact', () => {
    expect(advance('portfolio', 1000, [10000, 0], 25, 5)).toEqual([12815, 0]);
    expect(advance('portfolio', 0, [1000, 0], 0, 0)).toEqual([1100, 0]);
    expect(advance('retirement', 0, [100000, 0], 15000, 7)).toEqual([113900, 0]);
    expect(advance('retirement', 0, [100000, 0], 15000, 0)).toEqual([69700, 0]);
    expect(advance('retirement', 0, [1001, 0], 0, 0)).toEqual([821, 0]);
    expect(advance('retirement', 0, [5000, 0], 9000, 7)).toEqual([0, 0]);
    expect(advance('insurance', 3000, [3000, 0], 85, 7)).toEqual([2950, 0]);
    expect(advance('insurance', 3000, [3000, 0], 100, 7)).toEqual([4000, 0]);
    expect(advance('life', 4000, [1000, 5000], 40, 0)).toEqual([3468, 4250]);
    expect(advance('life', 0, [100, 1000], 50, 7)).toEqual([0, 5500]);
    expect(advance('life', 4000, [0, 500], 100, 0)).toEqual([3570, 0]);
    expect(worth([3468, 4250])).toBe(-782);
    for (const scenario of ['portfolio', 'retirement', 'insurance', 'life'] as const) expect(OUTCOME_TABLE[scenario], scenario).toHaveLength(OUTCOMES);
    expect(CHAPTER_YEARS).toEqual({ portfolio: 4, retirement: 4, insurance: 1, life: 2 });
    expect(ANSWER_RULE).toEqual({ portfolio: 'highest', retirement: 'highest', insurance: 'lowest', life: 'all' });
  });

  it('counts the histories exactly and the chance of a goal with only sums and products', () => {
    expect(waysOf(tiny({}), 100)).toBe(64);
    expect(waysOf(tiny({ floor: 4001 }), 100)).toBe(0);
    expect(waysOf(tiny({ finish: 5000, floor: 4000 }), 100)).toBe(64);
    expect(waysOf(tiny({ finish: 5001 }), 100)).toBe(0);
    expect(waysOf(tiny({}), 0)).toBe(49);
    expect(waysOf(tiny({ periods: 3 }), 0)).toBeGreaterThan(0);
    expect(waysOf(tiny({ periods: 3 }), 0)).toBeLessThan(512);
    expect(reachChance(8, 8, 99)).toBe(1);
    expect(reachChance(0, 8, 50)).toBe(0);
    expect(reachChance(1, 2, 50)).toBeCloseTo(0.5398, 3);
    expect(reachChance(7, 8, 50)).toBeGreaterThan(1 - 1e-12);
    expect(reachChance(3, 8, 90)).toBeLessThan(1e-12);
    let previous = 0;
    for (let ways = 0; ways <= 64; ways += 1) {
      const reach = reachChance(ways, 64, 70);
      expect(reach).toBeGreaterThanOrEqual(previous);
      previous = reach;
    }
    expect(reachChance(40, 64, 70)).toBe(reachChance(40, 64, 70));
  });

  it('draws the same futures for every choice, from the seed alone', () => {
    const seed = seedOf('life-portfolio-risk');
    const payload = payloadOf('life-portfolio-risk');
    const draws = drawOutcomes(seed, payload.periods);
    expect(draws).toHaveLength(FUTURES * payload.periods);
    expect(Array.from(draws).every((outcome) => outcome >= 0 && outcome < OUTCOMES)).toBe(true);
    expect(Array.from(drawOutcomes(seed, payload.periods))).toEqual(Array.from(draws));
    expect(Array.from(drawOutcomes(seedFor(1), payload.periods))).not.toEqual(Array.from(draws));
    const low = futuresOf(seed, payload, 0);
    const high = futuresOf(seed, payload, 100);
    expect(low).toHaveLength(FUTURES);
    expect(low.every((future) => future.path.length === payload.periods + 1 && future.path[0] === worth([payload.cash, payload.debt]))).toBe(true);
    expect(futuresOf(seed, payload, 100)).toEqual(high);
    expect(low.map((future) => future.path[1])).not.toEqual(high.map((future) => future.path[1]));
    expect(successCount(seed, payload, 25)).toBe(98);
    expect(successCount(seed, payload, 80)).toBeLessThan(payload.goal);
  });

  it('keeps the cushion series the floor is judged on: the worth, or the cash of a life', () => {
    const portfolio = payloadOf('life-portfolio-risk');
    for (const future of futuresOf(seedOf('life-portfolio-risk'), portfolio, 60)) {
      expect(future.cushions).toEqual(future.path);
      expect(future.lowest).toBe(Math.min(...future.cushions.slice(1)));
    }
    const life = payloadOf('life-debt-or-save');
    for (const future of futuresOf(seedOf('life-debt-or-save'), life, 40)) {
      expect(future.cushions).toHaveLength(life.periods + 1);
      expect(future.cushions[0]).toBe(life.cash);
      expect(future.cushions).not.toEqual(future.path);
      expect(future.lowest).toBe(Math.min(...future.cushions.slice(1)));
      expect(future.ok).toBe(future.path[life.periods]! >= life.finish && future.lowest >= life.floor);
    }
  });

  it('solves every fixture: the answers are the reliable choices, every other choice is a clear miss', () => {
    for (const entry of SIM2_FIXTURES) {
      const payload = entry.segment('en-US').payload as Payload;
      const analysis = analyse(payload);
      expect(analysis.problem, entry.id).toBeNull();
      expect(analysis.answers, entry.id).toEqual((entry.rubric as { target: { answers: number[] } }).target.answers);
      payload.choices.forEach((choice, index) => {
        const reach = analysis.reach[index] as number;
        if (analysis.answers.includes(choice)) expect(reach, `${entry.id} ${choice}`).toBeGreaterThanOrEqual(1 - SOLVE_TAIL);
        else if (reach >= 1 - SOLVE_TAIL) expect(ANSWER_RULE[payload.scenario], `${entry.id} ${choice}`).not.toBe('all');
        else expect(reach, `${entry.id} ${choice}`).toBeLessThanOrEqual(MISS_TAIL);
      });
      expect(analysis.ways.every((ways) => ways >= 0 && ways <= OUTCOMES ** payload.periods), entry.id).toBe(true);
      expect(analyse(payload)).toBe(analysis);
    }
    expect(analyse(payloadOf('life-portfolio-risk')).answers).toEqual([25]);
    expect(analyse(payloadOf('life-retirement-spend')).answers).toEqual([15000]);
    expect(analyse(payloadOf('life-insurance-cover')).answers).toEqual([85]);
    expect(analyse(payloadOf('life-debt-or-save')).answers).toEqual([30, 40, 50]);
  });

  it('refuses a payload with no clean answer: none, a lucky borderline, or a start that already solves it', () => {
    const portfolio = payloadOf('life-portfolio-risk');
    expect(analyse({ ...portfolio, finish: 9_000_000 }).problem).toBe('No choice reaches the goal reliably');
    expect(analyse({ ...portfolio, start: 25 }).problem).toBe('The start choice already solves the piece');
    const lucky = Array.from({ length: GOAL_MAX - GOAL_MIN + 1 }, (_, index) => GOAL_MIN + index).map((goal) => analyse({ ...portfolio, goal }).problem).filter((problem) => problem?.includes('by luck'));
    expect(lucky.length).toBeGreaterThan(0);
  });

  it('accepts a well-formed payload only', () => {
    const base = payloadOf('life-debt-or-save');
    expect(isPayload(base)).toBe(true);
    expect(payloadProblem(base)).toBeNull();
    const bad: Record<string, unknown>[] = [
      { ...base, scenario: 'lottery' }, { ...base, periods: 1 }, { ...base, periods: 6 }, { ...base, periods: 2.5 }, { ...base, debt: 0 }, { ...base, goal: 49 }, { ...base, goal: 100 },
      { ...base, choices: [0, 50] }, { ...base, choices: [50, 0, 100] }, { ...base, choices: [0, 50, 101] }, { ...base, start: 7 }, { ...base, cash: -1 }, { ...base, floor: 1.5 }, { ...base, extra: 1 },
      { ...base, scenario: 'portfolio', debt: 5000 },
    ];
    for (const payload of bad) {
      expect(isPayload(payload), JSON.stringify(payload)).toBe(false);
      expect(payloadProblem(payload), JSON.stringify(payload)).not.toBeNull();
    }
    expect(isChoices('retirement', [10000, 20000, 30000])).toBe(true);
    expect(isChoices('insurance', [10000, 20000, 30000])).toBe(false);
    expect(isChoices('insurance', [0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(false);
  });

  it('grades from the solved key and the seeded replay: met, review, valid and invalid', () => {
    expect(verdictOf('life-portfolio-risk', { seed: seedOf('life-portfolio-risk'), choice: 25 })).toBe('met');
    expect(verdictOf('life-portfolio-risk', { seed: seedOf('life-portfolio-risk'), choice: 10 })).toBe('review');
    expect(verdictOf('life-portfolio-risk', { seed: seedOf('life-portfolio-risk'), choice: 60 })).toBe('review');
    expect(verdictOf('life-portfolio-risk', { seed: seedOf('life-portfolio-risk'), choice: 80 })).toBe('valid');
    expect(verdictOf('life-retirement-spend', { seed: seedOf('life-retirement-spend'), choice: 15000 })).toBe('met');
    expect(verdictOf('life-retirement-spend', { seed: seedOf('life-retirement-spend'), choice: 10000 })).toBe('review');
    expect(verdictOf('life-insurance-cover', { seed: seedOf('life-insurance-cover'), choice: 85 })).toBe('met');
    expect(verdictOf('life-insurance-cover', { seed: seedOf('life-insurance-cover'), choice: 95 })).toBe('review');
    expect(verdictOf('life-insurance-cover', { seed: seedOf('life-insurance-cover'), choice: 25 })).toBe('review');
    for (const choice of [30, 40, 50]) expect(verdictOf('life-debt-or-save', { seed: seedOf('life-debt-or-save'), choice }), `${choice}`).toBe('met');
    for (const choice of [0, 5, 95]) expect(verdictOf('life-debt-or-save', { seed: seedOf('life-debt-or-save'), choice }), `${choice}`).toBe('review');
    expect(verdictOf('life-debt-or-save', { seed: seedOf('life-debt-or-save'), choice: 100 })).toBe('valid');
  });

  it('judges an answer met under any attempt seed, since an answer reaches the goal reliably', () => {
    for (const entry of SIM2_FIXTURES) {
      const answers = (entry.rubric as { target: { answers: number[] } }).target.answers;
      for (let index = 0; index < 8; index += 1) {
        const seed = seedFor(index);
        for (const choice of answers) expect(grade(entry.segment('en-US'), { seed, choice }, entry.rubric, { seed }).verdict, `${entry.id} ${choice} ${index}`).toBe('met');
      }
    }
  });

  it('refuses a malformed response, a choice not offered, a wrong key and a payload with no clean answer', () => {
    const id = 'life-portfolio-risk';
    const seed = seedOf(id);
    const answers = (rubric: unknown) => verdictOf(id, { seed, choice: 25 }, rubric);
    expect(verdictOf(id, { seed, choice: 7 })).toBe('invalid');
    expect(verdictOf(id, { seed, choice: '25' })).toBe('invalid');
    expect(verdictOf(id, { seed, choice: 25.5 })).toBe('invalid');
    expect(verdictOf(id, { seed })).toBe('invalid');
    expect(verdictOf(id, { choice: 25 })).toBe('invalid');
    expect(verdictOf(id, { seed, choice: 25, extra: 1 })).toBe('invalid');
    expect(answers({ target: { answers: [10] } })).toBe('invalid');
    expect(answers({ target: { answers: [25, 10] } })).toBe('invalid');
    expect(answers({ target: { answers: [] } })).toBe('invalid');
    expect(answers({ target: { answers: 25 } })).toBe('invalid');
    expect(answers({ target: { answers: [25], extra: 1 } })).toBe('invalid');
    expect(answers({ target: { answers: [25] }, extra: 1 })).toBe('invalid');
    expect(answers({ answers: [25] })).toBe('invalid');
    expect(answers(null)).toBe('invalid');
    const segment = segmentOf(id);
    const payload = segment.payload as Payload;
    const withPayload = (next: unknown) => ({ ...segment, payload: next });
    expect(grade(withPayload({ ...payload, start: 25 }), { seed, choice: 25 }, fixture(id).rubric, { seed }).verdict).toBe('invalid');
    expect(grade(withPayload({ ...payload, finish: 9_000_000 }), { seed, choice: 25 }, fixture(id).rubric, { seed }).verdict).toBe('invalid');
    expect(grade(withPayload({ ...payload, choices: [0, 10] }), { seed, choice: 25 }, fixture(id).rubric, { seed }).verdict).toBe('invalid');
    expect(grade(withPayload(null), { seed, choice: 25 }, fixture(id).rubric, { seed }).verdict).toBe('invalid');
    expect(grade(undefined, { seed, choice: 25 }, fixture(id).rubric, { seed }).verdict).toBe('invalid');
  });

  it('binds every run to the seed of the attempt', () => {
    for (const entry of SIM2_FIXTURES) {
      const seed = entry.seed as string;
      const other = seed.startsWith('0') ? 'f'.repeat(64) : '0'.repeat(64);
      const met = entry.ladder.met as Record<string, unknown>;
      const segment = entry.segment('en-US');
      expect(grade(segment, met, entry.rubric, { seed }).verdict, entry.id).toBe('met');
      expect(grade(segment, met, entry.rubric, { seed: other }).verdict, entry.id).toBe('invalid');
      expect(grade(segment, met, entry.rubric).verdict, entry.id).toBe('invalid');
      expect(grade(segment, { ...met, seed: other }, entry.rubric, { seed }).verdict, entry.id).toBe('invalid');
      expect(grade(segment, { ...met, seed: seed.toUpperCase() }, entry.rubric, { seed }).verdict, entry.id).toBe('invalid');
      expect(grade(segment, { ...met, seed: 'short' }, entry.rubric, { seed }).verdict, entry.id).toBe('invalid');
    }
  });

  it('never says met in the browser, which holds no rubric', () => {
    for (const entry of SIM2_FIXTURES) {
      const segment = entry.segment('en-US');
      expect(grade(segment, entry.ladder.met, undefined).verdict, entry.id).toBe('valid');
      expect(grade(segment, entry.ladder.invalid, undefined).verdict, entry.id).toBe('invalid');
      expect(grade(segment, entry.ladder.met, undefined, { seed: entry.seed as string }).verdict, entry.id).toBe('valid');
      expect(grade(segment, entry.ladder.met, undefined, { seed: SAMPLE_ATTEMPT.seed }).verdict, entry.id).toBe(entry.seed === SAMPLE_ATTEMPT.seed ? 'valid' : 'invalid');
    }
  });

  it('is open to the declared ages only', () => {
    const scope = (band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type: 'money.life-sim.v2' }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('13-17', 13, 17)).toBeNull();
    expect(scope('13-17', 15, 17)).toBeNull();
    expect(scope('adult', 18, 99)).toBeNull();
    expect(scope('10-12', 10, 12)).not.toBeNull();
    expect(scope('6-9', 6, 9)).not.toBeNull();
    expect(scope('13-17', 12, 17)).not.toBeNull();
  });

  it('plugs into Core: public schema, answer key, the publish-time sample and the server grade under the attempt seed', () => {
    for (const entry of SIM2_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
    for (const entry of SIM2_FIXTURES) {
      const document = lesson(entry);
      const id = entry.segment('en-US').id as string;
      const keys = { [id]: entry.rubric };
      const attempt = { seed: entry.seed as string };
      expect(validateV2LessonForGrading(document, keys, { lessonId: document.lesson_id, locale: document.locale }), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met, attempt), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toBeNull();
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met, { seed: attempt.seed.startsWith('0') ? 'f'.repeat(64) : '0'.repeat(64) }), entry.id).toBeNull();
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid, attempt), entry.id).toBeNull();
      expect(horizonteGrade({ type: 'money.life-sim.v2' }, entry.ladder.met, entry.rubric), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
    const insurance = fixture('life-insurance-cover');
    const wrong = { 'life-insurance-cover': { target: { answers: [25] } } };
    const document = lesson(insurance);
    expect(validateV2LessonForGrading(document, wrong, { lessonId: document.lesson_id, locale: document.locale })).toBeNull();
    expect(gradeV2Visual(v2PublicLessonSchema.parse(document), { 'life-insurance-cover': insurance.rubric }, 'life-insurance-cover', { seed: seedOf('life-insurance-cover'), choice: 25 }, { seed: seedOf('life-insurance-cover') }))
      .toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
  });

  it('refuses a payload that leaks the answer, a wrong visual, a bad setup and an out-of-scope document', () => {
    const base = lesson(fixture('life-portfolio-risk'));
    const payload = base.segments[0]!.payload as Record<string, unknown>;
    const withPayload = (next: unknown) => ({ ...base, segments: [{ ...base.segments[0], payload: next }] });
    expect(v2PublicLessonSchema.safeParse(withPayload(payload)).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, target: { answers: [25] } })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, answers: [25] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, seed: 'e'.repeat(64) })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, scenario: 'lottery' })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, periods: 9 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, goal: 100 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, choices: [0, 10] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, choices: [10, 0, 25] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, start: 7 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ ...payload, debt: 100 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...base.segments[0], visual: { type: 'galton-sim' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 99 } }).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } }).success).toBe(false);
  });
});
