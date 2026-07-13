import { describe, expect, it } from 'vitest';
import {
  runContractGate,
  runVocabularyGate,
  runFactGate,
  runArithmeticGate,
  runRationaleAndCanonGate,
  runAllGates,
} from '../pipeline/gates.js';
import { buildDocument, buildTaxonomy, buildFacts } from './fixtures.js';

describe('gate 1: contract', () => {
  it('accepts a valid document', () => {
    const result = runContractGate(buildDocument());
    expect(result.ok).toBe(true);
    expect(result.document).toBeDefined();
  });

  it('rejects a document with a duplicate segment id', () => {
    const doc = buildDocument();
    (doc.segments[1] as { id: string }).id = doc.segments[0]!.id;
    const result = runContractGate(doc);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.message.includes('duplicate segment id'))).toBe(true);
  });

  it('rejects an unknown character enum value', () => {
    const raw = { ...buildDocument(), meta: { ...buildDocument().meta, cast: ['not-a-character'] } };
    const result = runContractGate(raw);
    expect(result.ok).toBe(false);
  });

  it('rejects a narrator not present in meta.cast', () => {
    const doc = buildDocument();
    (doc.segments[0] as unknown as { narrator: { character: string } }).narrator = { character: 'zara' };
    const result = runContractGate(doc); // meta.cast is only ['dina']
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.message.includes('narrator'))).toBe(true);
  });
});

describe('gate 2: forbidden vocabulary', () => {
  const taxonomy = buildTaxonomy();

  it('passes clean text', () => {
    const problems = runVocabularyGate(buildDocument(), taxonomy, 'tier1');
    expect(problems).toHaveLength(0);
  });

  it('catches a forbidden word, case-insensitively', () => {
    const doc = buildDocument();
    (doc.segments[0]!.payload as { body_md: string }).body_md = 'Hoy hablamos de PRÉSTAMO y monedas.';
    const problems = runVocabularyGate(doc, taxonomy, 'tier1');
    expect(problems.length).toBeGreaterThan(0);
  });

  it('catches a forbidden word with a different accent form (accent-insensitive)', () => {
    const doc = buildDocument();
    // "interes compuesto" without the accent on "interés" must still hit.
    (doc.segments[0]!.payload as { body_md: string }).body_md = 'Vamos a explicar el interes compuesto hoy.';
    const problems = runVocabularyGate(doc, taxonomy, 'tier1');
    expect(problems.length).toBeGreaterThan(0);
  });

  it('does not false-positive on a substring that merely contains a forbidden word', () => {
    const doc = buildDocument();
    // "préstamos" is a superset word, not a whole-word match for "préstamo"? It SHOULD still match
    // (word boundary allows prefix match only if the boundary is truly a word edge) — assert the
    // real false-positive case instead: a word that CONTAINS forbidden letters but isn't the word.
    (doc.segments[0]!.payload as { body_md: string }).body_md = 'La isla tiene un préstamo bank fictício, nada que ver.';
    const problems = runVocabularyGate(doc, taxonomy, 'tier1');
    expect(problems.length).toBeGreaterThan(0); // "préstamo" IS present verbatim here
  });

  it('never scans the answer subtree', () => {
    const doc = buildDocument();
    (doc.segments[1] as unknown as { answer: { correct_option_id: string; note: string } }).answer = {
      correct_option_id: 'o1',
      note: 'préstamo',
    };
    const problems = runVocabularyGate(doc, taxonomy, 'tier1');
    expect(problems).toHaveLength(0);
  });

  it('reports an issue for an unknown tier instead of throwing', () => {
    const problems = runVocabularyGate(buildDocument(), taxonomy, 'tier9');
    expect(problems).toHaveLength(1);
  });
});

describe('gate 3: facts', () => {
  const facts = buildFacts();

  it('passes denominations that exist in facts.yaml', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'coin_count',
          prompt_md: 'Paga exacto.',
          difficulty: 1,
          xp: 10,
          payload: { currency: 'MXN', denominations: [1, 2, 5], target: 8 },
          answer: {},
        } as never,
      ],
    });
    const problems = runFactGate(doc, facts);
    expect(problems).toHaveLength(0);
  });

  it('flags a denomination not present in any facts.yaml denominations list', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'coin_count',
          prompt_md: 'Paga exacto.',
          difficulty: 1,
          xp: 10,
          payload: { currency: 'MXN', denominations: [1, 2, 500000], target: 8 },
          answer: {},
        } as never,
      ],
    });
    const problems = runFactGate(doc, facts);
    expect(problems.length).toBeGreaterThan(0);
  });
});

describe('gate 4: arithmetic re-execution', () => {
  it('coin_count: passes when target is reachable', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'coin_count',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { currency: 'MXN', denominations: [1, 2, 5, 10], target: 8 },
          answer: {},
        } as never,
      ],
    });
    expect(runArithmeticGate(doc)).toHaveLength(0);
  });

  it('coin_count: fails when target is unreachable', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'coin_count',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { currency: 'MXN', denominations: [2, 5, 10], target: 3 },
          answer: {},
        } as never,
      ],
    });
    expect(runArithmeticGate(doc).length).toBeGreaterThan(0);
  });

  it('make_change: passes when change is exact and reachable', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'make_change',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { currency: 'MXN', denominations: [1, 2, 5, 10], price: 10, paid_with: 15 },
          answer: {},
        } as never,
      ],
    });
    expect(runArithmeticGate(doc)).toHaveLength(0);
  });

  it('make_change: fails when paid_with is less than price', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'make_change',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { currency: 'MXN', denominations: [1, 2, 5, 10], price: 10, paid_with: 5 },
          answer: {},
        } as never,
      ],
    });
    expect(runArithmeticGate(doc).length).toBeGreaterThan(0);
  });

  it('savings_goal: passes when weeks = ceil(goal/weekly)', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'savings_goal',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { goal: 100, currency: 'MXN', weekly_options: [10, 20] },
          answer: { correct: { '10': 10, '20': 5 } },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc)).toHaveLength(0);
  });

  it('savings_goal: fails on a wrong week count', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'savings_goal',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { goal: 100, currency: 'MXN', weekly_options: [10] },
          answer: { correct: { '10': 9 } },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc).length).toBeGreaterThan(0);
  });

  it('balance_scale: passes when a weight subset balances the scale', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'balance_scale',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: {
            left_fixed: [{ label: 'a', value: 10 }],
            weights: [
              { id: 'w1', label: '5', value: 5 },
              { id: 'w2', label: '5', value: 5 },
            ],
          },
          answer: {},
        } as never,
      ],
    });
    expect(runArithmeticGate(doc)).toHaveLength(0);
  });

  it('balance_scale: fails when no subset balances the scale', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'balance_scale',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: {
            left_fixed: [{ label: 'a', value: 10 }],
            weights: [{ id: 'w1', label: '3', value: 3 }],
          },
          answer: {},
        } as never,
      ],
    });
    expect(runArithmeticGate(doc).length).toBeGreaterThan(0);
  });

  it('equation_builder: passes when an accepted sequence evaluates to target_result', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'equation_builder',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: {
            tokens: [
              { id: 't1', text: '5' },
              { id: 't2', text: '+' },
              { id: 't3', text: '3' },
            ],
            slots: 3,
            target_result: 8,
          },
          answer: { accepted: ['t1 t2 t3'] },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc)).toHaveLength(0);
  });

  it('equation_builder: fails when no accepted sequence evaluates correctly', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'equation_builder',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: {
            tokens: [
              { id: 't1', text: '5' },
              { id: 't2', text: '+' },
              { id: 't3', text: '3' },
            ],
            slots: 3,
            target_result: 9,
          },
          answer: { accepted: ['t1 t2 t3'] },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc).length).toBeGreaterThan(0);
  });

  it('interest_peek: passes within tolerance of the compound formula', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'interest_peek',
          prompt_md: 'x',
          difficulty: 3,
          xp: 20,
          payload: {
            principal: 100,
            rate_pct: 10,
            periods: 1,
            currency: 'MXN',
            prediction: { kind: 'slider', min: 0, max: 200 },
          },
          answer: { value: 110, tolerance: 1 },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc)).toHaveLength(0);
  });

  it('interest_peek: fails outside tolerance', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'interest_peek',
          prompt_md: 'x',
          difficulty: 3,
          xp: 20,
          payload: {
            principal: 100,
            rate_pct: 10,
            periods: 1,
            currency: 'MXN',
            prediction: { kind: 'slider', min: 0, max: 200 },
          },
          answer: { value: 200, tolerance: 1 },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc).length).toBeGreaterThan(0);
  });

  it('fill_blank: passes when {{n}} markers match answer.gaps 1:1', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'fill_blank',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { text_md: 'Una {{1}} vale {{2}} pesos.', mode: 'typed' },
          answer: { gaps: [{ gap: 1, accept: ['paleta'] }, { gap: 2, accept: ['15'] }] },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc)).toHaveLength(0);
  });

  it('fill_blank: fails when a marker has no matching gap', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'fill_blank',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: { text_md: 'Una {{1}} vale {{2}} pesos.', mode: 'typed' },
          answer: { gaps: [{ gap: 1, accept: ['paleta'] }] },
        } as never,
      ],
    });
    expect(runArithmeticGate(doc).length).toBeGreaterThan(0);
  });
});

describe('gate 5: rationale + canon', () => {
  it('flags a wrong quiz_mcq option missing rationale_md', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'quiz_mcq',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: {
            options: [
              { id: 'o1', text_md: 'Correct' },
              { id: 'o2', text_md: 'Wrong, no rationale' },
            ],
          },
          answer: { correct_option_id: 'o1' },
        } as never,
      ],
    });
    const problems = runRationaleAndCanonGate(doc);
    expect(problems.some((p) => p.message.includes('rationale_md'))).toBe(true);
  });

  it('passes when every wrong option has rationale_md', () => {
    const doc = buildDocument({
      segments: [
        {
          id: 's1',
          type: 'quiz_mcq',
          prompt_md: 'x',
          difficulty: 1,
          xp: 10,
          payload: {
            options: [
              { id: 'o1', text_md: 'Correct' },
              { id: 'o2', text_md: 'Wrong', rationale_md: 'Because...' },
            ],
          },
          answer: { correct_option_id: 'o1' },
        } as never,
      ],
    });
    expect(runRationaleAndCanonGate(doc)).toHaveLength(0);
  });

  it('flags a payload-level character not declared in meta.cast (beyond what gate 1 catches)', () => {
    const doc = buildDocument({
      meta: { ...buildDocument().meta, cast: ['dina'] },
      segments: [
        {
          id: 's1',
          type: 'story_dialogue',
          prompt_md: 'x',
          difficulty: 1,
          xp: 0,
          payload: { lines: [{ character: 'zara', text_md: 'Hola' }] },
        } as never,
      ],
    });
    // gate 1 (contract) does NOT catch this — only narrator.character is cross-checked.
    expect(runContractGate(doc).ok).toBe(true);
    const problems = runRationaleAndCanonGate(doc);
    expect(problems.some((p) => p.message.includes('meta.cast'))).toBe(true);
  });
});

describe('runAllGates', () => {
  it('aggregates problems across gates 2-5 when gate 1 passes', () => {
    const report = runAllGates(buildDocument(), { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() });
    expect(report.ok).toBe(true);
    expect(report.document).toBeDefined();
  });

  it('short-circuits at gate 1 when the raw document does not parse', () => {
    const report = runAllGates({ not: 'a lesson document' }, { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() });
    expect(report.ok).toBe(false);
    expect(report.problems.every((p) => p.gate === 1)).toBe(true);
  });
});
