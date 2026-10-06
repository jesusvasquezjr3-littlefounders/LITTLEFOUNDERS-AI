// GAP-FIX-R2 learning: the Stage 2 gates carried over to v2 documents
// (Appendix C Part 3 Stage 2; B.22, B.26, B.27; G.2 no exempt path).
import { describe, expect, it } from 'vitest';
import {
  evaluateExpression, loadCarriedCourseData, runV2CarriedGates, v2AgeRegisterGate, v2AntiGenericityGate,
  v2ArithmeticGate, v2ClarityGate, v2GenerationQualityGate, v2RationaleAndCanonGate, v2ReadabilityGate,
  v2RewardAndWellbeingGates, v2VocabularyGate,
} from '../v2/carriedGates.js';
import { v2TextBlocks } from '../v2/gates.js';
import { V2_MANIFEST_GATES } from '../v2/release.js';

const document = (segments: unknown[], extra: Record<string, unknown> = {}) => ({
  schema_version: 2, course_id: 'financial-education', locale: 'en-US', age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 },
  title: 'Split your coins', segments, ...extra,
});
const allocation = (prompt: string) => ({ id: 'allocate-01', type: 'money.allocation.v2', grading: 'server', prompt, visual: { type: 'stacked-bar' },
  payload: { total: 12, step: 1, currency: 'coins' } });

describe('v2 carried gates', () => {
  it('recomputes equalities in teaching narration while allowing an explicitly staged mistake', () => {
    const turn = (line: string) => ({ id: 'example', type: 'voice.mentor-turn.v2', payload: { line } });
    expect(v2ArithmeticGate(document([turn('Start with 20: 20 + 10 = 35.')]), undefined)).toEqual([expect.objectContaining({ gate: 4, segmentId: 'example' })]);
    expect(v2ArithmeticGate(document([turn('Then 30 − 5 = 25.')]), undefined)).toEqual([]);
    expect(v2ArithmeticGate(document([turn('Some 1,50 + 2,25 = 3,75.')], { locale: 'pt-BR' }), undefined)).toEqual([]);
    expect(v2ArithmeticGate(document([turn('10% × 200 = 20.')]), undefined)).toEqual([]);
    expect(v2ArithmeticGate(document([turn('1 ÷ 0 = 3.')]), undefined)).toHaveLength(1);
    expect(v2ArithmeticGate(document([{ id: 'episode', type: 'voice.mentor-episode.v2', payload: {
      misjudgment: 'I thought 20 + 10 = 35.', recovery: 'I recalculated: 20 + 10 = 30.',
    } }]), undefined)).toEqual([]);
  });
  it('gate 17 blocks a randomized reward on a v2 segment and reviews mystery-prize copy', () => {
    const findings = v2RewardAndWellbeingGates(document([{ ...allocation('Split 12 coins.'), xp: [5, 10] }]));
    expect(findings.some((item) => item.gate === 17 && item.severity === 'block')).toBe(true);
    const review = v2RewardAndWellbeingGates(document([allocation('Spin the wheel for a mystery prize.')]));
    expect(review.some((item) => item.gate === 17 && item.severity === 'review')).toBe(true);
  });

  it('gate 18 blocks shame and family-finance moralizing, never structural ids', () => {
    expect(v2RewardAndWellbeingGates(document([allocation('You are bad with money.')])).filter((item) => item.gate === 18 && item.severity === 'block')).not.toHaveLength(0);
    expect(v2RewardAndWellbeingGates(document([{ ...allocation('Split 12 coins.'), id: 'lazy-poor-01' }]))).toEqual([]);
  });

  it('gate 2 reads the tiers the eligibility reaches and keeps pt-BR accents apart', () => {
    const data = loadCarriedCourseData('financial-education');
    expect(v2VocabularyGate(document([allocation('Earn interest on 12 coins.')]), data).map((item) => item.gate)).toEqual([2]);
    // "Divida" (divide) is not "dívida" (debt).
    expect(v2VocabularyGate(document([allocation('Divida 12 moedas.')], { locale: 'pt-BR' }), data)).toEqual([]);
    expect(v2VocabularyGate(document([allocation('Pague a dívida.')], { locale: 'pt-BR' }), data).map((item) => item.gate)).toEqual([2]);
    // A teen lesson reaches no 6-10 tier.
    expect(v2VocabularyGate(document([allocation('Earn interest on 12 coins.')], { age_band: '13-17', eligibility: { minimum_age: 13, maximum_age: 17 } }), data)).toEqual([]);
    expect(v2VocabularyGate(document([allocation('Split.')], { course_id: 'no-such-course' }), loadCarriedCourseData('no-such-course')).map((item) => item.severity)).toEqual(['block']);
  });

  it('gate 4 re-executes worked steps, keys, change and unit prices', () => {
    expect(evaluateExpression('20% × 50')).toBe(10);
    expect(evaluateExpression('50 − 10')).toBe(40);
    expect(evaluateExpression('3 × 4,50')).toBe(13.5);
    expect(evaluateExpression('Sale price')).toBeNull();
    const worked = { id: 'worked-01', type: 'math.worked-example.v2', payload: { steps: [
      { id: 'step-one', expression: '20% × 50', result: '10' }, { id: 'step-two', expression: '50 − 10', result: '40' }, { id: 'step-end', expression: 'Sale price', result: '40' }] } };
    expect(v2ArithmeticGate(document([worked]), { 'worked-01': { expectedValues: { 'step-two': '40', 'step-end': '40' } } })).toEqual([]);
    expect(v2ArithmeticGate(document([worked]), { 'worked-01': { expectedValues: { 'step-two': '41', 'step-end': '40' } } }).map((item) => item.gate)).toEqual([4]);
    const change = { id: 'change-01', type: 'money.making-change.v2', payload: { price_minor: 13, paid_minor: 20 } };
    expect(v2ArithmeticGate(document([change]), { 'change-01': { change_minor: 6 } }).map((item) => item.gate)).toEqual([4]);
    const unit = { id: 'unit-01', type: 'money.unit-price.v2', payload: { currency: 'coins', offers: [{ id: 'small', quantity: 3, price_minor: 45 }] } };
    expect(v2ArithmeticGate(document([unit]), { 'unit-01': { unit_prices: { small: '15' } } })).toEqual([]);
    expect(v2ArithmeticGate(document([unit]), { 'unit-01': { unit_prices: { small: '45/2' } } }).map((item) => item.gate)).toEqual([4]);
  });

  it('runs every carried gate in one pass and lists them in the v2 publication manifest', () => {
    expect(runV2CarriedGates(document([allocation('Split 12 coins.')]), { 'allocate-01': { minimumSave: 3 } }).problems).toEqual([]);
    for (const id of [
      'forge.gate.02.age-vocabulary', 'forge.gate.03.currency-facts', 'forge.gate.04.arithmetic', 'forge.gate.05.rationale-canon',
      'forge.gate.06.anti-genericity', 'forge.gate.07.generation-quality', 'forge.gate.08.clarity', 'forge.gate.09.readability',
      'forge.gate.17.reward-mechanics', 'forge.gate.18.wellbeing-language', 'forge.gate.19.age-register',
    ]) {
      expect(V2_MANIFEST_GATES).toContain(id);
    }
  });

  describe('gates 5-9', () => {
    const choice = (extra: Record<string, unknown> = {}) => ({
      id: 'choice-01', type: 'story.branch.v2', grading: 'server', prompt: 'Which plan protects the goal?', visual: { type: 'branch-map' },
      payload: { options: [{ id: 'save-first', label: 'Save for the bicycle goal' }, { id: 'spend-all', label: 'Spend every coin today' }] },
      feedback: { met: 'You protected the bicycle goal.', not_yet: 'Compare each choice with the bicycle goal.' }, ...extra,
    });
    const key = { 'choice-01': { acceptable_choice_ids: ['save-first'] } };

    it('gate 5 blocks out-of-canon characters and rejected choices with no rationale or corrective feedback', () => {
      const noFeedback = choice({ feedback: undefined, payload: { character: 'milo', options: [
        { id: 'save-first', label: 'Save for the bicycle goal' }, { id: 'spend-all', label: 'Spend every coin today' },
      ] } });
      const findings = v2RationaleAndCanonGate(document([noFeedback]), key);
      expect(findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ gate: 5, message: expect.stringContaining('outside the closed canon') }),
        expect.objectContaining({ gate: 5, segmentId: 'choice-01', message: expect.stringContaining('has no rationale') }),
      ]));
      expect(v2RationaleAndCanonGate(document([choice({ payload: { character: 'zara', options: [
        { id: 'save-first', label: 'Save for the bicycle goal' }, { id: 'spend-all', label: 'Spend every coin today' },
      ] } })]), key)).toEqual([]);
    });

    it('gate 6 blocks title echoes, canned filler and generic learning instructions while concrete tasks pass', () => {
      expect(v2AntiGenericityGate(document([allocation('Split your coins')], { title: 'Split your coins' }))).toEqual([
        expect.objectContaining({ gate: 6, message: expect.stringContaining('near-duplicate') }),
      ]);
      expect(v2AntiGenericityGate(document([allocation('In this exercise you will learn about saving.')])))
        .toEqual(expect.arrayContaining([expect.objectContaining({ gate: 6, message: expect.stringContaining('banned filler') })]));
      expect(v2AntiGenericityGate(document([allocation('Practice saving.')])))
        .toEqual(expect.arrayContaining([expect.objectContaining({ gate: 6, message: expect.stringContaining('generic learning') })]));
      expect(v2AntiGenericityGate(document([allocation('Zara has 12 coins. Move at least 3 to Save.')]))).toEqual([]);
    });

    it('gate 7 requires answer evidence and blocks broken quality scales and emoji on answer-critical surfaces', () => {
      expect(v2GenerationQualityGate(document([choice()]), {})).toEqual([
        expect.objectContaining({ gate: 7, message: expect.stringContaining('no private answer evidence') }),
      ]);
      expect(v2GenerationQualityGate(document([choice({ prompt: 'Pick a plan 🚀' })]), { 'choice-01': { qualities: { save: 1, spend: 0 } } }))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ gate: 7, message: expect.stringContaining('0–1 scale') }),
          expect.objectContaining({ gate: 7, message: expect.stringContaining('emoji') }),
        ]));
      expect(v2GenerationQualityGate(document([choice()]), key)).toEqual([]);
    });

    it('gate 8 blocks text walls, fake questions, answer leaks, hidden facts and non-visual graded steps', () => {
      const bad = choice({
        prompt: `${'Long background sentence. '.repeat(8)}The correct answer is Save for the bicycle goal`,
        help: ['Each badge costs 17 coins.'], visual: { type: 'text' },
      });
      const findings = v2ClarityGate(document([bad]), key);
      expect(findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ gate: 8, message: expect.stringContaining('max 160') }),
        expect.objectContaining({ gate: 8, message: expect.stringContaining('explicitly reveals the correct answer') }),
        expect.objectContaining({ gate: 8, message: expect.stringContaining('load-bearing fact') }),
        expect.objectContaining({ gate: 8, message: expect.stringContaining('visual-first') }),
      ]));
      expect(v2ClarityGate(document([{ id: 'show-01', type: 'visual.chart.v2', grading: 'none', prompt: 'Did you get it?', visual: { type: 'bar-chart' }, payload: {} }]), {}))
        .toEqual([expect.objectContaining({ gate: 8, message: expect.stringContaining('takes no answer') })]);
      expect(v2ClarityGate(document([choice()]), key)).toEqual([]);
    });

    it('gate 8 does not confuse procedures, currency decimals or Mentor reflection questions with hidden inputs', () => {
      const procedural = choice({
        prompt: 'Offer A is $2,040 for 170 hours. Offer B is $1,800 for 144. Which rate is higher?',
        help: ['Divide each total by its hours, then compare the two results.'],
      });
      const mentor = { id: 'mentor-01', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'What would you check first?', visual: { type: 'speech-plate' }, payload: { line: 'Pause and look for the price.' } };
      expect(v2ClarityGate(document([procedural, mentor]), key)).toEqual([]);
    });

    it.each([
      ['en-US', 'Institutional diversification necessitates comprehensive methodological consideration of intertemporal capitalization, probabilistic volatility, administrative obligations, and systematically differentiated socioeconomic contingencies.'],
      ['es-MX', 'La determinación sistemática de la rentabilidad operativa requiere consideraciones metodológicas extraordinariamente sofisticadas, incorporando simultáneamente obligaciones tributarias, depreciación institucional y periodificación financiera internacional.'],
      ['pt-BR', 'A determinação sistemática da rentabilidade operacional requer considerações metodológicas extraordinariamente sofisticadas, incorporando simultaneamente obrigações tributárias, depreciação institucional e periodização financeira internacional.'],
    ])('gate 9 blocks adult prose for ages 6-9 in %s and lets short copy remain unjudged', (locale, prose) => {
      const hard = Array(4).fill(prose).join(' ');
      expect(v2ReadabilityGate(document([allocation(hard)], { locale, age_band: '6-9' })))
        .toEqual([expect.objectContaining({ gate: 9, severity: 'block' })]);
      expect(v2ReadabilityGate(document([allocation('Move 3 coins.')], { locale, age_band: '6-9' }))).toEqual([]);
    });

    it('routes gates 5-9 into the blocking carried-gate report used by the emitter', () => {
      const adult = Array(4).fill('Institutional diversification necessitates comprehensive methodological consideration of intertemporal capitalization, probabilistic volatility, administrative obligations, and systematically differentiated socioeconomic contingencies.').join(' ');
      const broken = choice({ prompt: `In this exercise you will learn. 🚀 ${adult}`, visual: { type: 'text' }, payload: { character: 'milo' } });
      const report = runV2CarriedGates(document([broken]), { 'choice-01': { qualities: { a: 1, b: 0 } } });
      const gates = new Set(report.problems.map((problem) => problem.gate));
      for (const gate of [5, 6, 7, 8, 9]) expect(gates.has(gate), `gate ${gate} must block`).toBe(true);
    });
  });

  /*
   * GAP-FIX-R6 (B.20, B.23; Bible 02 §9.2; Appendix B §1.8): gate 19 now runs on v2 documents. From age 10 every
   * graded step names what was done right in `feedback.met`, generic praise (a bare "Correct" included) blocks,
   * the feedback strings are budgeted body copy, and gate 18's shame screen reads them too.
   */
  const tween = { age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } };
  const withFeedback = (feedback: Record<string, string>) => ({ ...allocation('Split 12 coins. Save at least 3.'), feedback });
  it('gate 19 requires named feedback on every graded v2 step from age 10, and not below', () => {
    expect(v2AgeRegisterGate(document([allocation('Split 12 coins.')], tween))).toEqual([
      expect.objectContaining({ gate: 19, severity: 'block', segmentId: 'allocate-01', message: expect.stringMatching(/needs feedback\.met/) })]);
    expect(v2AgeRegisterGate(document([withFeedback({ met: 'Your plan saves the goal and uses every coin.' })], tween))).toEqual([]);
    expect(v2AgeRegisterGate(document([allocation('Split 12 coins.')]))).toEqual([]);
  });

  it('gate 19 blocks praise that names nothing and a number the step does not show; gate 18 screens feedback for shame', () => {
    for (const met of ['Great job!', 'Correct', 'That works.']) {
      expect(v2AgeRegisterGate(document([withFeedback({ met })], tween)).map((item) => `${item.gate}:${item.severity}`), met).toContain('19:block');
    }
    expect(v2AgeRegisterGate(document([withFeedback({ met: 'You saved 9 of them.' })], tween))).toEqual([
      expect.objectContaining({ gate: 19, severity: 'block', message: expect.stringMatching(/feedback\.met shows 9/) })]);
    expect(v2RewardAndWellbeingGates(document([withFeedback({ met: 'Your plan saves the goal.', not_yet: "Not yet. You're not a saver." })], tween))
      .some((item) => item.gate === 18 && item.severity === 'block')).toBe(true);
  });

  it('counts both feedback lines as body copy under the Copy Budget', () => {
    const blocks = v2TextBlocks(document([withFeedback({ met: 'Your plan saves the goal.', not_yet: 'Not yet. Move coins into savings.' })], tween));
    expect(blocks.filter((block) => block.path.startsWith('feedback.'))).toEqual([
      { segmentId: 'allocate-01', path: 'feedback.met', role: 'body', text: 'Your plan saves the goal.' },
      { segmentId: 'allocate-01', path: 'feedback.not_yet', role: 'body', text: 'Not yet. Move coins into savings.' },
    ]);
  });
});
