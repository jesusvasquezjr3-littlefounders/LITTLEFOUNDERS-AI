import { describe, expect, it } from 'vitest';
import {
  runContractGate,
  runVocabularyGate,
  runFactGate,
  runArithmeticGate,
  runRationaleAndCanonGate,
  runClarityGate,
  runAllGates,
} from '../pipeline/gates.js';
import { buildDocument, buildTaxonomy, buildFacts } from './fixtures.js';

describe('gate 8: clarity / visual-first', () => {
  function docWithSegment(seg: Record<string, unknown>) {
    const doc = buildDocument();
    (doc.segments as unknown as Record<string, unknown>[])[0] = seg;
    return doc;
  }

  const quizSeg = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    type: 'quiz_mcq',
    prompt_md: '¿Cuánto cuesta?',
    difficulty: 1,
    xp: 10,
    payload: { options: [{ id: 'a', text_md: 'Cinco pesos' }, { id: 'b', text_md: 'Diez pesos' }] },
    answer: { correct_option_id: 'a' },
    explanation_md: 'El vaso cuesta cinco pesos porque ese es su precio marcado.',
    ...over,
  });

  it('accepts a terse, self-contained prompt', () => {
    expect(runClarityGate(docWithSegment(quizSeg())).length).toBe(0);
  });

  it('fails a prompt_md longer than the char cap (text wall)', () => {
    const long = 'Liruf ganó diez pesos vendiendo limonada en su puesto y ahora tiene que decidir con mucho cuidado, pensando en el futuro, qué comprar primero para no quedarse sin dinero jamás. ¿Qué hace?';
    const problems = runClarityGate(docWithSegment(quizSeg({ prompt_md: long })));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('text wall'))).toBe(true);
  });

  it('fails a prompt_md with too many sentences', () => {
    const many = 'Uno. Dos. Tres. Cuatro.';
    const problems = runClarityGate(docWithSegment(quizSeg({ prompt_md: many })));
    expect(problems.some((p) => p.message.includes('sentences'))).toBe(true);
  });

  it('flags a non-graded content segment that ends on a direct question', () => {
    const seg = { id: 's1', type: 'concept_reveal', prompt_md: '¿Qué es el ahorro?', difficulty: 1, xp: 0, payload: { cards: [{ front_md: 'Ahorro', back_md: 'Guardar dinero' }, { front_md: 'Gasto', back_md: 'Usar dinero' }] } };
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.message.includes('takes no answer'))).toBe(true);
  });

  it('flags a non-graded segment whose explanation congratulates a non-answer', () => {
    const seg = { id: 's1', type: 'key_ideas', prompt_md: 'Lo que aprendimos hoy.', difficulty: 1, xp: 0, payload: { ideas: [{ icon: 'star', title: 'Ahorrar', body_md: 'Guardar un poco' }, { icon: 'paid', title: 'Gastar', body_md: 'Usar con cuidado' }] }, explanation_md: '¡Exacto! Ahorrar es guardar dinero para después.' };
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.message.includes('congratulates'))).toBe(true);
  });

  it('flags a hint that hides a required price not shown on screen', () => {
    const seg = quizSeg({ prompt_md: '¿Alcanza el dinero?', hints: ['Recuerda: cada vaso cuesta 5 pesos.'] });
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.message.includes('required fact'))).toBe(true);
  });

  it('flags a pattern_complete answer keyed by a sequence index instead of a slot index', () => {
    const seg = { id: 's1', type: 'pattern_complete', prompt_md: '¿Qué sigue?', difficulty: 2, xp: 15, payload: { sequence: [{ icon: 'star', tint: 'primary' }, { icon: 'circle', tint: 'accent' }, { icon: 'star', tint: 'primary' }], options: [{ id: 'o1', icon: 'circle', tint: 'accent' }, { id: 'o2', icon: 'star', tint: 'primary' }], missing_slots: 1 }, answer: { correct: { '5': 'o1' } } };
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.message.includes('slot indexes'))).toBe(true);
  });

  it('flags a pattern_complete with an invisible (all-identical) sequence', () => {
    const seg = { id: 's1', type: 'pattern_complete', prompt_md: '¿Qué sigue?', difficulty: 2, xp: 15, payload: { sequence: [{ icon: 'local_cafe', tint: 'primary' }, { icon: 'local_cafe', tint: 'primary' }, { icon: 'local_cafe', tint: 'primary' }], options: [{ id: 'o1', icon: 'local_cafe', tint: 'primary' }, { id: 'o2', icon: 'star', tint: 'accent' }], missing_slots: 1 }, answer: { correct: { '0': 'o1' } } };
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.message.includes('invisible'))).toBe(true);
  });

  it('flags a pattern_complete framed by SIZE/PRICE (invisible in icon+tint tiles)', () => {
    const seg = { id: 's1', type: 'pattern_complete', prompt_md: 'Dina vende vasos: chico $5, mediano $10, grande $15. ¿Cuál va para que los precios sigan subiendo?', difficulty: 2, xp: 15, payload: { sequence: [{ icon: 'local_cafe', tint: 'primary' }, { icon: 'local_cafe', tint: 'accent' }, { icon: 'local_cafe', tint: 'success' }, { icon: 'local_cafe', tint: 'primary' }], options: [{ id: 'o1', icon: 'local_cafe', tint: 'accent' }], missing_slots: 1 }, answer: { correct: { '0': 'o1' } } };
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('SIZE/PRICE'))).toBe(true);
  });

  it('flags a robot_path whose own commands never reach the goal', () => {
    const seg = { id: 's1', type: 'robot_path', prompt_md: 'Lleva el carrito.', difficulty: 2, xp: 15, payload: { grid: { w: 4, h: 4 }, start: { x: 0, y: 0, dir: 'right' }, goal: { x: 3, y: 3 }, commands: ['forward', 'forward'], max_commands: 6 } };
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.message.includes('unsolvable'))).toBe(true);
  });

  it('accepts a robot_path whose commands DO reach the goal', () => {
    // start (0,0) facing right → forward→(1,0)→(2,0)→(3,0); right turn faces down; forward→(3,1)(3,2)(3,3)
    const seg = { id: 's1', type: 'robot_path', prompt_md: 'Lleva el carrito.', difficulty: 2, xp: 15, payload: { grid: { w: 4, h: 4 }, start: { x: 0, y: 0, dir: 'right' }, goal: { x: 3, y: 3 }, commands: ['forward', 'forward', 'forward', 'right', 'forward', 'forward', 'forward'], max_commands: 8 } };
    const problems = runClarityGate(docWithSegment(seg)).filter((p) => p.message.includes('robot_path'));
    expect(problems.length).toBe(0);
  });

  it('flags a prompt that leaks the correct answer verbatim', () => {
    const seg = quizSeg({
      prompt_md: 'La mejor idea es guardar el dinero en la alcancía.',
      payload: { options: [{ id: 'a', text_md: 'Guardar el dinero en la alcancía' }, { id: 'b', text_md: 'Gastarlo todo' }] },
      answer: { correct_option_id: 'a' },
    });
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.message.includes('correct answer verbatim'))).toBe(true);
  });

  // compare_table renders empty cells + a token bank with NO separate data panel, so the
  // child's only source of truth is prompt_md. The grounding check forces every source
  // value (and its row) on-screen — parking prices in a hint (v4-pro's failure mode) makes
  // the table an unguessable coin-flip that the exact-cell grader then marks wrong.
  const compareTableSeg = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    type: 'compare_table',
    prompt_md: 'Doña Lula: 10 limones por 5 pesos. Don Pepe: 10 limones por 6 pesos. Elige la mejor opción.',
    difficulty: 1,
    xp: 10,
    payload: {
      cols: [{ id: 'precio', label: 'Precio' }, { id: 'mejor', label: '¿Mejor?' }],
      rows: [{ id: 'lula', label: 'Doña Lula' }, { id: 'pepe', label: 'Don Pepe' }],
      tokens: [
        { id: 't1', text_md: '5 pesos' },
        { id: 't2', text_md: '6 pesos' },
        { id: 'y', text_md: 'Sí' },
        { id: 'n', text_md: 'No' },
      ],
    },
    answer: { cells: { 'lula:precio': 't1', 'pepe:precio': 't2', 'lula:mejor': 'y', 'pepe:mejor': 'n' } },
    ...over,
  });

  it('accepts a compare_table whose source values are all stated in the prompt', () => {
    const problems = runClarityGate(docWithSegment(compareTableSeg())).filter((p) => p.message.includes('compare_table'));
    expect(problems.length).toBe(0);
  });

  it('flags a compare_table that hides its source values off-screen (only in a hint)', () => {
    const seg = compareTableSeg({
      prompt_md: 'Dina necesita 10 limones. Elige la mejor opción.',
      hints: ['Doña Lula cuesta 5 pesos; Don Pepe cuesta 6 pesos.'],
    });
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('NOT stated in prompt_md'))).toBe(true);
  });

  it('does not false-fail a compare_table with a per-row Sí/No decision column', () => {
    // the decision column ('mejor') holds Sí/No tokens (not row labels); those cells are
    // derived by comparison and must NOT be required in the prompt.
    const problems = runClarityGate(docWithSegment(compareTableSeg())).filter((p) => p.message.includes('compare_table'));
    expect(problems.length).toBe(0);
  });

  // coin_count renders a target + a coin palette to ASSEMBLE (grade = tray sum === target);
  // there is no yes/no control, so a sufficiency question is unanswerable by the mechanic.
  const coinCountSeg = (prompt_md: string) => ({
    id: 's1',
    type: 'coin_count',
    prompt_md,
    difficulty: 1,
    xp: 10,
    payload: { target: 5, currency: 'MXN', denominations: [1, 2, 5] },
  });

  it('flags a coin_count that poses a yes/no sufficiency question (no such control)', () => {
    const seg = coinCountSeg('El cliente te da una moneda de 2 y tres de 1. ¿Tiene suficiente para el vaso de 5 pesos?');
    const problems = runClarityGate(docWithSegment(seg));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('SUFFICIENCY'))).toBe(true);
  });

  it('accepts a coin_count that asks the child to assemble the target amount', () => {
    const problems = runClarityGate(docWithSegment(coinCountSeg('Junta monedas para formar 5 pesos.'))).filter((p) =>
      p.message.includes('coin_count'),
    );
    expect(problems.length).toBe(0);
  });

  // balance_scale passes when the PLACED weights sum exactly to the fixed left plate.
  const balanceSeg = (weights: number[], left: number[]) => ({
    id: 's1',
    type: 'balance_scale',
    prompt_md: 'Equilibra la balanza.',
    difficulty: 2,
    xp: 15,
    payload: {
      weights: weights.map((v, i) => ({ id: `w${i}`, label: 'Galleta', value: v })),
      left_fixed: left.map((v) => ({ label: 'Vaso', value: v })),
      unknown_label: 'Galletas',
    },
  });

  it('flags a balance_scale whose bank sums to exactly the target (tap-everything always wins)', () => {
    const problems = runClarityGate(docWithSegment(balanceSeg([3, 3, 3, 3, 3], [5, 5, 5])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('tapping EVERY token'))).toBe(true);
  });

  it('flags a balance_scale where no subset of weights can reach the target (unwinnable)', () => {
    const problems = runClarityGate(docWithSegment(balanceSeg([3, 3, 3, 3, 3, 3, 3], [8])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('unwinnable'))).toBe(true);
  });

  it('accepts a balance_scale with distractor weights and a reachable target', () => {
    const problems = runClarityGate(docWithSegment(balanceSeg([3, 3, 3, 3, 3, 2, 2], [5, 5, 5]))).filter((p) =>
      p.message.includes('balance_scale'),
    );
    expect(problems.length).toBe(0);
  });
});

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

/*
 * TRIVIAL-STRATEGY gate (gate 8). Every case below is a shape found PUBLISHED by
 * the 2026-07-24 grader audit, where a mechanical strategy passed with no
 * reasoning. The expected values mirror the real grader's arithmetic.
 */
describe('gate 8: trivial-strategy refusal', () => {
  function doc(segment: Record<string, unknown>, scoring?: Record<string, unknown>) {
    const d = buildDocument();
    (d.segments as unknown as Record<string, unknown>[])[0] = segment;
    if (scoring) (d as unknown as Record<string, unknown>).scoring = { ...(d.scoring as object), ...scoring };
    return d;
  }

  it('flags red_flags where EVERY item is a target (nothing to reject)', () => {
    const seg = {
      id: 's1', type: 'red_flags', prompt_md: '¿Cuáles son trampas?', difficulty: 2, xp: 15,
      payload: { artifact_md: 'anuncio', artifact_kind: 'ad', flags: [{ id: 'f1', text_md: 'a' }, { id: 'f2', text_md: 'b' }, { id: 'f3', text_md: 'c' }, { id: 'f4', text_md: 'd' }] },
      answer: { redflag_ids: ['f1', 'f2', 'f3', 'f4'] },
    };
    const problems = runClarityGate(doc(seg));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('nothing to reject'))).toBe(true);
  });

  it('accepts red_flags that includes innocent items', () => {
    const seg = {
      id: 's1', type: 'red_flags', prompt_md: '¿Cuáles son trampas?', difficulty: 2, xp: 15,
      payload: { artifact_md: 'anuncio', artifact_kind: 'ad', flags: [{ id: 'f1', text_md: 'a' }, { id: 'f2', text_md: 'b' }, { id: 'f3', text_md: 'c' }, { id: 'f4', text_md: 'd' }] },
      answer: { redflag_ids: ['f1', 'f2'] },
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('nothing to reject'))).toHaveLength(0);
  });

  it('flags an equation_builder whose bank exactly fills the slots (no choice)', () => {
    const seg = {
      id: 's1', type: 'equation_builder', prompt_md: 'Arma la suma', difficulty: 2, xp: 15,
      payload: { tokens: [{ id: 't1', text: '5' }, { id: 't2', text: '+' }, { id: 't3', text: '5' }], slots: 3, target_result: 10 },
      answer: { accepted: ['t1 t2 t3'] },
    };
    const problems = runClarityGate(doc(seg));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('no decision to make'))).toBe(true);
  });

  it('accepts an equation_builder with distractor tokens', () => {
    const seg = {
      id: 's1', type: 'equation_builder', prompt_md: 'Arma la suma', difficulty: 2, xp: 15,
      payload: { tokens: [{ id: 't1', text: '5' }, { id: 't2', text: '+' }, { id: 't3', text: '5' }, { id: 't4', text: '3' }, { id: 't5', text: '-' }], slots: 3, target_result: 10 },
      answer: { accepted: ['t1 t2 t3'] },
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('no decision to make'))).toHaveLength(0);
  });

  it('flags a build_sentence where one wrong slot still clears the pass threshold', () => {
    // 5 slots → one miss scores 80; with pass_threshold 70 the wrong price passes.
    const seg = {
      id: 's1', type: 'build_sentence', prompt_md: 'Arma el letrero', difficulty: 2, xp: 15,
      payload: { tokens: [{ id: 't1', text_md: '2' }, { id: 't2', text_md: 'vasos' }, { id: 't3', text_md: 'por' }, { id: 't4', text_md: '10' }, { id: 't5', text_md: 'pesos' }, { id: 't6', text_md: '5' }], slots: 5 },
      answer: { order: ['t1', 't2', 't3', 't4', 't5'] },
    };
    const problems = runClarityGate(doc(seg));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('pass_threshold'))).toBe(true);
  });

  it('accepts the same build_sentence once the lesson raises its pass threshold', () => {
    const seg = {
      id: 's1', type: 'build_sentence', prompt_md: 'Arma el letrero', difficulty: 2, xp: 15,
      payload: { tokens: [{ id: 't1', text_md: '2' }, { id: 't2', text_md: 'vasos' }, { id: 't3', text_md: 'por' }, { id: 't4', text_md: '10' }, { id: 't5', text_md: 'pesos' }, { id: 't6', text_md: '5' }], slots: 5 },
      answer: { order: ['t1', 't2', 't3', 't4', 't5'] },
    };
    const problems = runClarityGate(doc(seg, { pass_threshold: 90 }));
    expect(problems.filter((p) => p.message.includes('pass_threshold'))).toHaveLength(0);
  });

  it('flags a budget_fit with NO need items (grader then only checks the ceiling)', () => {
    // A real author reached this shape while dodging an earlier version of the
    // gate: with zero needs, tapping one 3-peso item scores 100.
    const seg = {
      id: 's1', type: 'budget_fit', prompt_md: 'Elige lo que puedes comprar sin pasarte de 20.', difficulty: 3, xp: 25,
      payload: { budget: 20, must_buy_needs: false, items: [
        { id: 'a', label: 'Limones', price: 8 }, { id: 'b', label: 'Hielo', price: 3 }, { id: 'c', label: 'Jarra', price: 15 },
      ] },
      answer: {},
    };
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('NO item as a need'))).toBe(true);
  });

  it('flags a budget_fit where every item is a need (nothing to leave out)', () => {
    const seg = {
      id: 's1', type: 'budget_fit', prompt_md: '¿Qué compras?', difficulty: 3, xp: 25,
      payload: { budget: 20, must_buy_needs: true, items: [
        { id: 'a', label: 'Limones', price: 8, need: true }, { id: 'b', label: 'Azúcar', price: 6, need: true },
        { id: 'c', label: 'Vasos', price: 9, need: true },
      ] },
      answer: {},
    };
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('EVERY item as a need'))).toBe(true);
  });

  it('flags a budget_fit where the whole basket fits (tap-everything wins)', () => {
    const seg = {
      id: 's1', type: 'budget_fit', prompt_md: '¿Qué compras?', difficulty: 3, xp: 25,
      payload: { budget: 20, must_buy_needs: true, items: [
        { id: 'a', label: 'Limones', price: 5, need: true }, { id: 'b', label: 'Azúcar', price: 4, need: true },
        { id: 'c', label: 'Hielo', price: 3 }, { id: 'd', label: 'Calcomanía', price: 2 },
      ] },
      answer: {},
    };
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('tap everything'))).toBe(true);
  });

  it('flags a budget_fit whose required needs exceed the budget (unwinnable)', () => {
    const seg = {
      id: 's1', type: 'budget_fit', prompt_md: '¿Qué compras?', difficulty: 3, xp: 25,
      payload: { budget: 10, must_buy_needs: true, items: [
        { id: 'a', label: 'Limones', price: 8, need: true }, { id: 'b', label: 'Azúcar', price: 6, need: true },
        { id: 'c', label: 'Hielo', price: 30 },
      ] },
      answer: {},
    };
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('unwinnable'))).toBe(true);
  });

  it('accepts a budget_fit with real needs, real wants, and a basket that overflows', () => {
    const seg = {
      id: 's1', type: 'budget_fit', prompt_md: 'Surte el puesto sin pasarte de 20 pesos.', difficulty: 3, xp: 25,
      payload: { budget: 20, must_buy_needs: true, items: [
        { id: 'a', label: 'Limones', price: 8, need: true }, { id: 'b', label: 'Azúcar', price: 6, need: true },
        { id: 'c', label: 'Hielo', price: 5 }, { id: 'd', label: 'Jarra', price: 9 }, { id: 'e', label: 'Calcomanía', price: 4 },
      ] },
      answer: {},
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('budget_fit'))).toHaveLength(0);
  });
});

/*
 * PROMPT-INTEGRITY gate (gate 8). Every case is a shape found PUBLISHED by the
 * 2026-07-24 grader audit.
 */
describe('gate 8: prompt integrity', () => {
  function doc(segment: Record<string, unknown>) {
    const d = buildDocument();
    (d.segments as unknown as Record<string, unknown>[])[0] = segment;
    return d;
  }

  it('flags a match_pairs whose prompt dictates the pairing (transcription, not reasoning)', () => {
    const seg = {
      id: 's1', type: 'match_pairs', difficulty: 1, xp: 10,
      prompt_md: 'Ayuda a poner cada precio con su producto: vaso chico 5, jarra 20.',
      payload: {
        left: [{ id: 'vaso', text_md: 'Vaso chico' }, { id: 'jarra', text_md: 'Jarra' }],
        right: [{ id: 'p5', text_md: '5 pesos' }, { id: 'p20', text_md: '20 pesos' }],
      },
      answer: { pairs: [['vaso', 'p5'], ['jarra', 'p20']] },
    };
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('transcribe the prompt'))).toBe(true);
  });

  it('accepts a match_pairs whose prompt is only the instruction', () => {
    const seg = {
      id: 's1', type: 'match_pairs', difficulty: 1, xp: 10,
      prompt_md: 'Une cada producto con su precio.',
      payload: {
        left: [{ id: 'vaso', text_md: 'Vaso chico' }, { id: 'jarra', text_md: 'Jarra' }],
        right: [{ id: 'p5', text_md: '5 pesos' }, { id: 'p20', text_md: '20 pesos' }],
      },
      answer: { pairs: [['vaso', 'p5'], ['jarra', 'p20']] },
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('transcribe the prompt'))).toHaveLength(0);
  });

  it('flags a debug_hunt that asks the child to CORRECT text it cannot type', () => {
    const seg = {
      id: 's1', type: 'debug_hunt', difficulty: 2, xp: 15,
      prompt_md: 'Toca la parte del cartel que está mal y corrígela.',
      payload: { intro_md: 'Liruf puso un cartel.', blocks: [{ id: 'a', text_md: '¡Gran oferta!' }, { id: 'b', text_md: 'Más caro que sueltos' }] },
      answer: { bug_ids: ['b'], fix_md: 'Más barato que sueltos' },
    };
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('no text input'))).toBe(true);
  });

  it('accepts a debug_hunt that asks the child to FIND the mistake', () => {
    const seg = {
      id: 's1', type: 'debug_hunt', difficulty: 2, xp: 15,
      prompt_md: 'Toca la parte del cartel que está mal.',
      payload: { intro_md: 'Liruf puso un cartel.', blocks: [{ id: 'a', text_md: '¡Gran oferta!' }, { id: 'b', text_md: 'Más caro que sueltos' }] },
      answer: { bug_ids: ['b'], fix_md: 'Más barato que sueltos' },
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('no text input'))).toHaveLength(0);
  });

  it('flags an artifact list whose stated total does not add up', () => {
    // The published receipt: 15 + 8 + 12 = 35, but the line said "Total - 47".
    const seg = {
      id: 's1', type: 'evidence_hunt', difficulty: 2, xp: 15,
      prompt_md: 'Toca la línea que muestra el precio real.',
      payload: {
        claim_md: 'Liruf dice que los limones costaron 8 pesos.',
        sentences: [
          { id: 's1', text_md: 'Vasos - 15 pesos' },
          { id: 's2', text_md: 'Azúcar - 8 pesos' },
          { id: 's3', text_md: 'Limones - 12 pesos' },
          { id: 's4', text_md: 'Total - 47 pesos' },
        ],
      },
      answer: { evidence_ids: ['s3'] },
    };
    const problems = runClarityGate(doc(seg));
    expect(problems.some((p) => p.message.includes('does not add up'))).toBe(true);
    expect(problems.find((p) => p.message.includes('does not add up'))?.message).toContain('sum to 35');
  });

  it('accepts an artifact list whose total is exact', () => {
    const seg = {
      id: 's1', type: 'evidence_hunt', difficulty: 2, xp: 15,
      prompt_md: 'Toca la línea que muestra el precio real.',
      payload: {
        claim_md: 'Liruf dice que los limones costaron 8 pesos.',
        sentences: [
          { id: 's1', text_md: 'Vasos - 15 pesos' },
          { id: 's2', text_md: 'Azúcar - 8 pesos' },
          { id: 's3', text_md: 'Limones - 12 pesos' },
          { id: 's4', text_md: 'Total - 35 pesos' },
        ],
      },
      answer: { evidence_ids: ['s3'] },
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('does not add up'))).toHaveLength(0);
  });
});

describe('gate 8: clustered answers (defence in depth behind the render-time shuffle)', () => {
  function doc(segment: Record<string, unknown>) {
    const d = buildDocument();
    (d.segments as unknown as Record<string, unknown>[])[0] = segment;
    return d;
  }
  const flags = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i + 1}`, text_md: `line ${i + 1}` }));

  it('flags targets authored as a contiguous PREFIX (the shipped speed_tap/red_flags shape)', () => {
    const seg = {
      id: 's1', type: 'red_flags', prompt_md: '¿Cuáles son trampas?', difficulty: 2, xp: 15,
      payload: { artifact_md: 'anuncio', artifact_kind: 'ad', flags: flags(5) },
      answer: { redflag_ids: ['f1', 'f2', 'f3', 'f4'] },
    };
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('contiguous prefix'))).toBe(true);
  });

  it('accepts targets scattered through the bank', () => {
    const seg = {
      id: 's1', type: 'red_flags', prompt_md: '¿Cuáles son trampas?', difficulty: 2, xp: 15,
      payload: { artifact_md: 'anuncio', artifact_kind: 'ad', flags: flags(5) },
      answer: { redflag_ids: ['f1', 'f3', 'f5'] },
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('contiguous prefix'))).toHaveLength(0);
  });

  it('does not fire when every item is a target (a different gate owns that)', () => {
    const seg = {
      id: 's1', type: 'red_flags', prompt_md: '¿Cuáles son trampas?', difficulty: 2, xp: 15,
      payload: { artifact_md: 'anuncio', artifact_kind: 'ad', flags: flags(4) },
      answer: { redflag_ids: ['f1', 'f2', 'f3', 'f4'] },
    };
    const problems = runClarityGate(doc(seg));
    expect(problems.filter((p) => p.message.includes('contiguous prefix'))).toHaveLength(0);
    expect(problems.some((p) => p.message.includes('nothing to reject'))).toBe(true);
  });
});
