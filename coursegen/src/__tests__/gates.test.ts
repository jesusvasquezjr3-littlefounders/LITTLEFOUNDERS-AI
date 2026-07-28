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
    // Denominations were [1, 2, 5] here; the 5 was changed to a 10 on 2026-07-25
    // because the target IS 5, and the trivial-strategy gate now refuses a
    // coin_count whose target is one of its own denominations (one tap = 100).
    // This fixture is about the SUFFICIENCY prompt rule, so it must be otherwise clean.
    payload: { target: 5, currency: 'MXN', denominations: [1, 2, 10] },
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

  // spot_error is graded with set-F1 over the tapped set vs answer.error_ids, so
  // "tap every step" scores 2P/(N+P) — the gate evaluates exactly that expression.
  const spotErrorSeg = (steps: number, errorIds: string[]) => ({
    id: 's1',
    type: 'spot_error',
    prompt_md: 'Toca el paso equivocado.',
    difficulty: 2,
    xp: 15,
    payload: { steps: Array.from({ length: steps }, (_, i) => ({ id: `p${i + 1}`, text_md: `Paso ${i + 1}` })) },
    answer: { error_ids: errorIds, correction_md: 'La suma es 15, no 20.' },
  });

  it('flags a spot_error where most steps are flawed (tap-everything passes)', () => {
    // 2 of 3 flawed → 2·2/(3+2) = 80 ≥ 70.
    const problems = runClarityGate(docWithSegment(spotErrorSeg(3, ['p1', 'p2'])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('tap EVERY step'))).toBe(true);
  });

  it('flags a spot_error whose keyed error id is not a real step (unwinnable)', () => {
    const problems = runClarityGate(docWithSegment(spotErrorSeg(4, ['p9'])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('unwinnable'))).toBe(true);
  });

  it('accepts the canonical spot_error shape: one flawed step among correct ones', () => {
    // 1 of 4 flawed → tap-everything scores 2·1/5 = 40, well under the gate.
    const problems = runClarityGate(docWithSegment(spotErrorSeg(4, ['p4']))).filter((p) =>
      p.message.includes('spot_error'),
    );
    expect(problems.length).toBe(0);
  });

  it('accepts a balance_scale with distractor weights and a reachable target', () => {
    const problems = runClarityGate(docWithSegment(balanceSeg([3, 3, 3, 3, 3, 2, 2], [5, 5, 5]))).filter((p) =>
      p.message.includes('balance_scale'),
    );
    expect(problems.length).toBe(0);
  });

  /*
   * yes_no_cases is graded with balancedDecisionAccuracy — mean(sensitivity,
   * specificity) — which pins both blanket answers at 50 on every MIXED key, so the
   * engine needs no help there (naive_strategy_passes, closed in core/scoring.ts). What
   * only authoring can prevent is a ONE-SIDED key: with `applies_ids` empty, "press NO
   * on every case" IS the answer key and scores 100. The gate re-runs the real grader's
   * arithmetic on both blanket strategies, so these tests are proofs, not heuristics.
   */
  const yesNoSeg = (cases: number, appliesIds: string[]) => ({
    id: 's1',
    type: 'yes_no_cases',
    prompt_md: '¿La regla aplica?',
    difficulty: 2,
    xp: 15,
    payload: {
      rule_md: 'Una necesidad es algo sin lo que no puedes vivir bien.',
      cases: Array.from({ length: cases }, (_, i) => ({ id: `c${i + 1}`, text_md: `Caso ${i + 1}` })),
    },
    answer: { applies_ids: appliesIds },
  });

  it('flags a yes_no_cases where the rule applies to NO case (press NO on everything = 100)', () => {
    const problems = runClarityGate(docWithSegment(yesNoSeg(6, [])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('yes_no_cases') && p.message.includes('pressing NO'))).toBe(true);
  });

  it('flags a yes_no_cases where the rule applies to EVERY case (press YES on everything = 100)', () => {
    const problems = runClarityGate(docWithSegment(yesNoSeg(4, ['c1', 'c2', 'c3', 'c4'])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('yes_no_cases') && p.message.includes('pressing YES'))).toBe(true);
  });

  it('flags a yes_no_cases whose keyed ids match no case (the grader ignores them, so NO wins)', () => {
    const problems = runClarityGate(docWithSegment(yesNoSeg(5, ['zz'])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('yes_no_cases') && p.message.includes('match no payload.cases'))).toBe(true);
  });

  it('accepts a mixed yes_no_cases key: both blanket taps score 50, well under the gate', () => {
    const problems = runClarityGate(docWithSegment(yesNoSeg(6, ['c1', 'c4']))).filter((p) =>
      p.message.includes('yes_no_cases'),
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

  // EXPECTATION CHANGED (2026-07-25): this used to assert that a 5-slot
  // build_sentence with distractors is REJECTED, because raw `positional` gave one
  // wrong slot 80. The grader now caps any imperfect ordering at
  // IMPERFECT_ORDER_CEILING (60), so one wrong slot cannot clear a 70 threshold at
  // ANY slot count and the shape is legitimate. The gate mirrors that cap, and stays
  // load-bearing only for a document that lowers its own pass mark to 60 or less —
  // which is what this test now pins.
  it('build_sentence: one wrong slot is only a free pass when the lesson pass mark is ≤ the order cap', () => {
    const seg = {
      id: 's1', type: 'build_sentence', prompt_md: 'Arma el letrero', difficulty: 2, xp: 15,
      payload: { tokens: [{ id: 't1', text_md: '2' }, { id: 't2', text_md: 'vasos' }, { id: 't3', text_md: 'por' }, { id: 't4', text_md: '10' }, { id: 't5', text_md: 'pesos' }, { id: 't6', text_md: '5' }], slots: 5 },
      answer: { order: ['t1', 't2', 't3', 't4', 't5'] },
    };
    // At the default 70 mark the capped score (60) fails, so nothing to flag.
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('pass_threshold'))).toBe(false);
    // At a 60 mark the cap stops protecting the objective — flag it.
    expect(runClarityGate(doc(seg, { pass_threshold: 60 })).some((p) => p.gate === 8 && p.message.includes('pass_threshold'))).toBe(true);
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

  /*
   * money family, 2026-07-25. coin_count renders the target amount in a pill above
   * a palette formatted with the SAME currency formatter, and the tray is graded on
   * its sum — so a target that is itself a denomination is passable with one
   * label-matching tap. piggy_split's only control is ±step per jar, and the grader
   * pays 100 only when every jar is inside its range: an even split that satisfies
   * every range is a label-blind win, and a step grid that cannot express the key
   * makes the segment unwinnable.
   */
  const coinCount = (target: number, denominations: number[]) => ({
    id: 's1', type: 'coin_count', prompt_md: 'Junta monedas para formar el total del día.', difficulty: 1, xp: 10,
    payload: { target, currency: 'MXN', denominations },
  });

  it('flags a coin_count whose target is one of its own denominations (one tap = 100)', () => {
    const problems = runClarityGate(doc(coinCount(5, [1, 2, 5, 10])));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('is itself one of the palette denominations'))).toBe(true);
  });

  it('accepts a coin_count whose target needs at least two coins', () => {
    // 5 is not in [1, 2, 10], and the palette total (13) is not the target either.
    expect(runClarityGate(doc(coinCount(5, [1, 2, 10]))).filter((p) => p.message.includes('coin_count'))).toHaveLength(0);
  });

  const piggySplit = (
    payload: Record<string, unknown>,
    targets: Record<string, { min: number; max: number }>,
  ) => ({
    id: 's1', type: 'piggy_split', prompt_md: 'Reparte lo que ganaste hoy.', difficulty: 2, xp: 15,
    payload, answer: { targets },
  });

  it('flags a piggy_split where an even split lands inside every range', () => {
    // income 10, step 1, 2 jars → tapping + in turn gives 5/5, inside both ranges.
    const seg = piggySplit(
      { income: 10, unit: 'MXN', step: 1, jars: [{ id: 'guitar', label: 'Guitarra', icon: 'savings' }, { id: 'ingredients', label: 'Ingredientes', icon: 'shopping_basket' }] },
      { guitar: { min: 4, max: 6 }, ingredients: { min: 4, max: 6 } },
    );
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('evenly across'))).toBe(true);
  });

  it('accepts the shipped piggy_split shape, where the even split misses a jar', () => {
    // The published lesson: 10 in, exactly 6 for the guitar and 4 for ingredients.
    const seg = piggySplit(
      { income: 10, unit: 'MXN', step: 1, jars: [{ id: 'guitar', label: 'Guitarra', icon: 'savings' }, { id: 'ingredients', label: 'Ingredientes', icon: 'shopping_basket' }] },
      { guitar: { min: 6, max: 6 }, ingredients: { min: 4, max: 4 } },
    );
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('piggy_split'))).toHaveLength(0);
  });

  it('flags a piggy_split whose step cannot total the income (nothing submittable)', () => {
    const seg = piggySplit(
      { income: 10, unit: 'MXN', step: 3, jars: [{ id: 'a', label: 'A', icon: 'savings' }, { id: 'b', label: 'B', icon: 'savings' }] },
      { a: { min: 6, max: 6 }, b: { min: 4, max: 4 } },
    );
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('does not divide the income'))).toBe(true);
  });

  it('flags a piggy_split whose target range holds no multiple of the step', () => {
    const seg = piggySplit(
      { income: 10, unit: 'MXN', step: 1, jars: [{ id: 'a', label: 'A', icon: 'savings' }, { id: 'b', label: 'B', icon: 'savings' }] },
      { a: { min: 6.2, max: 6.4 }, b: { min: 3.6, max: 3.8 } },
    );
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('no multiple of the'))).toBe(true);
  });

  it('flags a piggy_split whose targets do not cover every jar (money uncounted → 0)', () => {
    const seg = piggySplit(
      { income: 10, unit: 'MXN', step: 1, jars: [{ id: 'a', label: 'A', icon: 'savings' }, { id: 'b', label: 'B', icon: 'savings' }] },
      { a: { min: 6, max: 6 } },
    );
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('does not cover exactly the payload.jars ids'))).toBe(true);
  });

  /*
   * would_you_rather is ONE tap between two cards and the score is the authored
   * quality of the side tapped, so two sides both keyed above the pass line make an
   * unfailable exercise. The gate evaluates the grader's own expression.
   */
  const wouldYouRather = (qualities: Record<string, number>) => ({
    id: 's1', type: 'would_you_rather', prompt_md: '¿Qué le conviene a Dina?', difficulty: 2, xp: 10,
    payload: { a: { text_md: 'Gastar 10 en un dulce ahora', icon: 'cake' }, b: { text_md: 'Esperar y recibir 5 pesos', icon: 'savings' } },
    answer: { qualities, reveal_md: 'Esperar junta 25 pesos: lo justo para el libro.' },
  });

  it('flags a would_you_rather whose BOTH sides clear the pass threshold (one tap cannot fail)', () => {
    const problems = runClarityGate(doc(wouldYouRather({ a: 100, b: 80 })));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('cannot fail'))).toBe(true);
  });

  it('flags an all-zero would_you_rather map (the grader scores either tap 100)', () => {
    const problems = runClarityGate(doc(wouldYouRather({ a: 0, b: 0 })));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('all-zero map'))).toBe(true);
  });

  it('flags a 0–1 scale would_you_rather once rescaled (0.9 → 90, 0.8 → 80)', () => {
    const problems = runClarityGate(doc(wouldYouRather({ a: 0.9, b: 0.8 })));
    expect(problems.some((p) => p.gate === 8 && p.message.includes('would_you_rather'))).toBe(true);
  });

  it('accepts the shipped would_you_rather shape: one clearly weaker side', () => {
    // The published lesson keys { a: 0, b: 100 } — tapping a fails, so the tap decides.
    expect(runClarityGate(doc(wouldYouRather({ a: 0, b: 100 }))).filter((p) => p.message.includes('would_you_rather'))).toHaveLength(0);
  });

  /*
   * story_branch: the grader averages the qualities of the choices taken at nodes that
   * offered >= 2 choices (one-choice "continue" nodes are not decisions and are not
   * graded). These cases enumerate every root-to-end path with that arithmetic.
   */
  const storyBranch = (
    nodes: Array<{ id: string; choices: Array<{ id: string; next: string | null }> }>,
    qualities: Array<{ node_id: string; choice_id: string; score: number }>,
  ) => ({
    id: 's1', type: 'story_branch', prompt_md: '¿Qué precio eliges?', difficulty: 2, xp: 15,
    payload: {
      start_node: nodes[0]?.id,
      nodes: nodes.map((n) => ({ id: n.id, text_md: `Escena ${n.id}`, choices: n.choices.map((c) => ({ ...c, text_md: `Opción ${c.id}` })) })),
    },
    answer: { qualities },
  });
  // The shipped lemonade shape: one 3-way decision, then a one-choice ending per branch.
  const shippedNodes = [
    { id: 'start', choices: [{ id: 'c3', next: 'p3' }, { id: 'c5', next: 'p5' }, { id: 'c10', next: 'p10' }] },
    { id: 'p3', choices: [{ id: 'end3', next: null }] },
    { id: 'p5', choices: [{ id: 'end5', next: null }] },
    { id: 'p10', choices: [{ id: 'end10', next: null }] },
  ];

  it('accepts the shipped story_branch shape (25 / 95 / 10 across three paths)', () => {
    const seg = storyBranch(shippedNodes, [
      { node_id: 'start', choice_id: 'c3', score: 25 },
      { node_id: 'start', choice_id: 'c5', score: 95 },
      { node_id: 'start', choice_id: 'c10', score: 10 },
    ]);
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('story_branch'))).toHaveLength(0);
  });

  it('flags a story_branch that keys only the best choice (the wrong turns are free)', () => {
    const seg = storyBranch(shippedNodes, [{ node_id: 'start', choice_id: 'c5', score: 95 }]);
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('costs the child NOTHING'))).toBe(true);
  });

  it('flags a story_branch where every path already passes (no wrong turn to take)', () => {
    const seg = storyBranch(shippedNodes, [
      { node_id: 'start', choice_id: 'c3', score: 80 },
      { node_id: 'start', choice_id: 'c5', score: 95 },
      { node_id: 'start', choice_id: 'c10', score: 90 },
    ]);
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('no wrong turn to take'))).toBe(true);
  });

  it('flags a story_branch whose best path cannot reach the pass threshold (unwinnable)', () => {
    const seg = storyBranch(shippedNodes, [
      { node_id: 'start', choice_id: 'c3', score: 25 },
      { node_id: 'start', choice_id: 'c5', score: 60 },
      { node_id: 'start', choice_id: 'c10', score: 10 },
    ]);
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('unwinnable'))).toBe(true);
  });

  it('flags a story_branch with no multi-choice node at all (nothing is decided)', () => {
    const seg = storyBranch(
      [
        { id: 'b1', choices: [{ id: 'ok1', next: 'b2' }] },
        { id: 'b2', choices: [{ id: 'ok2', next: null }] },
      ],
      [
        { node_id: 'b1', choice_id: 'ok1', score: 100 },
        { node_id: 'b2', choice_id: 'ok2', score: 100 },
      ],
    );
    expect(runClarityGate(doc(seg)).some((p) => p.gate === 8 && p.message.includes('no node that offers more than one choice'))).toBe(true);
  });

  it('does not count forced continue nodes as paths that pass (they are not decisions)', () => {
    // Two forced continues keyed 100 after a 10-scored wrong turn: the OLD grader
    // averaged them to exactly 70 and passed. The gate must still see a failing path.
    const seg = storyBranch(
      [
        { id: 'd1', choices: [{ id: 'good', next: 'k1' }, { id: 'bad', next: 'k1' }] },
        { id: 'k1', choices: [{ id: 'ok1', next: 'k2' }] },
        { id: 'k2', choices: [{ id: 'ok2', next: null }] },
      ],
      [
        { node_id: 'd1', choice_id: 'good', score: 100 },
        { node_id: 'd1', choice_id: 'bad', score: 10 },
        { node_id: 'k1', choice_id: 'ok1', score: 100 },
        { node_id: 'k2', choice_id: 'ok2', score: 100 },
      ],
    );
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('story_branch'))).toHaveLength(0);
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

  // spot_error is debug_hunt's twin: checkbox step cards, and `answer.correction_md`
  // shown only after grading. A prompt that asks for the corrected sum
  // (prompt_mechanic_mismatch, 2026-07-25) is unanswerable with that control set.
  const spotErrorPrompt = (prompt_md: string) => ({
    id: 's1', type: 'spot_error', difficulty: 2, xp: 15,
    prompt_md,
    payload: {
      context_md: 'Liruf anotó sus ventas.',
      steps: [
        { id: 'p1', text_md: 'Lunes: 1 vaso → 5 pesos.' },
        { id: 'p2', text_md: 'Martes: 1 vaso → 5 pesos.' },
        { id: 'p3', text_md: 'Miércoles: 1 vaso → 5 pesos.' },
        { id: 'p4', text_md: 'Suma final: 5 + 5 + 5 = 20 pesos.' },
      ],
    },
    answer: { error_ids: ['p4'], correction_md: 'La suma es 15, no 20.' },
  });

  it('flags a spot_error that asks the child to CORRECT arithmetic it cannot type', () => {
    const seg = spotErrorPrompt('Toca el paso donde se equivocó y corrige la suma.');
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('no text input'))).toBe(true);
  });

  it('flags a spot_error that asks the child to WRITE the right total', () => {
    const seg = spotErrorPrompt('Encuentra el paso mal y escribe la suma correcta.');
    expect(runClarityGate(doc(seg)).some((p) => p.message.includes('no text input'))).toBe(true);
  });

  it('accepts a spot_error that only asks the child to FIND the flawed step', () => {
    const seg = spotErrorPrompt('Liruf revisa su cuaderno. Toca el paso donde se equivocó.');
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

describe('gate 8: clustered answers — single-target lists are not "clustered"', () => {
  it('does not flag a one-target bank whose target happens to be first', () => {
    // Regression: a regenerated evidence_hunt with ONE keyed sentence was flagged.
    // "Tap the first N and get N right" needs N >= 2 to be a strategy at all.
    const d = buildDocument();
    (d.segments as unknown as Record<string, unknown>[])[0] = {
      id: 's1', type: 'evidence_hunt', prompt_md: 'Toca el renglón correcto.', difficulty: 2, xp: 15,
      payload: {
        claim_md: 'Los limones costaron 12 pesos.',
        sentences: [
          { id: 's1', text_md: 'Limones - 12 pesos' }, { id: 's2', text_md: 'Vasos - 15 pesos' },
          { id: 's3', text_md: 'Azúcar - 8 pesos' }, { id: 's4', text_md: 'Total - 35 pesos' },
        ],
      },
      answer: { evidence_ids: ['s1'] },
    };
    expect(runClarityGate(d).filter((p) => p.message.includes('contiguous prefix'))).toHaveLength(0);
  });
});

// ---- gate 8: maker family — the mechanic must fit the answer -------------------
// Each case below is the arithmetic of the real runtime, not a heuristic: the
// engine's bank shuffle for code_order, signalDetection's need for negatives in
// debug_hunt, toleranceBands + the tick grid for measure_read, and the
// widget/grader branch for machine_io.
describe('gate 8: maker mechanic fit', () => {
  function makerDoc(seg: Record<string, unknown>) {
    const d = buildDocument();
    (d.segments as unknown as Record<string, unknown>[])[0] = seg;
    return d;
  }
  const messages = (seg: Record<string, unknown>) => runClarityGate(makerDoc(seg)).map((p) => p.message);
  const flagged = (seg: Record<string, unknown>, needle: string) =>
    messages(seg).some((m) => m.includes(needle));

  const codeOrder = (ids: string[], over: Record<string, unknown> = {}) => ({
    id: 's1',
    type: 'code_order',
    prompt_md: '¿Cuál es el orden correcto?',
    difficulty: 2,
    xp: 15,
    payload: { blocks: ids.map((id, i) => ({ id, text_md: `paso ${i + 1}` })) },
    answer: { order: ids },
    explanation_md: 'La caja registradora de Rho cobra, verifica y luego anota la venta.',
    ...over,
  });

  it('accepts the published s1-code-order shape (the engine bounds the rendered bank)', () => {
    // Plain seededSort returned the SOLUTION order for this exact segment id +
    // ids, so "tap top-to-bottom" scored kendall 100. seededSortMiddling moves it.
    const seg = codeOrder(['recibir_pago', 'verificar_monto', 'dar_cambio', 'anotar_venta'], { id: 's1-code-order' });
    expect(flagged(seg, 'the engine renders the block bank')).toBe(false);
  });

  it('never flags a code_order at any bank size — the display order is bounded by construction', () => {
    for (let n = 3; n <= 8; n++) {
      const ids = Array.from({ length: n }, (_, i) => `b${i + 1}`);
      for (let s = 0; s < 25; s++) {
        const seg = codeOrder(ids, { id: `seg-${n}-${s}` });
        expect(flagged(seg, 'the engine renders the block bank')).toBe(false);
      }
    }
  });

  const debugHunt = (blockIds: string[], bugIds: string[]) => ({
    id: 's1',
    type: 'debug_hunt',
    prompt_md: 'Toca el bloque con el error.',
    difficulty: 1,
    xp: 10,
    payload: {
      intro_md: 'Liruf revisa su cartel.',
      blocks: blockIds.map((id, i) => ({ id, text_md: `linea ${i + 1}` })),
    },
    answer: { bug_ids: bugIds },
    explanation_md: 'El bloque del precio está mal: dos vasos por ocho pesos sale más barato.',
  });

  it('flags a debug_hunt with every block keyed as a bug (nothing to leave alone)', () => {
    expect(flagged(debugHunt(['b1', 'b2', 'b3'], ['b1', 'b2', 'b3']), 'keys EVERY one of its 3 blocks')).toBe(true);
  });

  it('flags a debug_hunt bug id that is not a real block (untappable → unwinnable)', () => {
    expect(flagged(debugHunt(['b1', 'b2', 'b3'], ['b9']), 'do not exist in payload.blocks')).toBe(true);
  });

  it('accepts a debug_hunt with one bug among clean blocks', () => {
    expect(messages(debugHunt(['b1', 'b2', 'b3', 'b4'], ['b3'])).filter((m) => m.includes('debug_hunt'))).toHaveLength(0);
  });

  const measureRead = (payload: Record<string, unknown>, answer: Record<string, unknown>) => ({
    id: 's1',
    type: 'measure_read',
    prompt_md: '¿Cuántos mililitros marca la jarra?',
    difficulty: 2,
    xp: 15,
    payload: { instrument: 'beaker', unit: 'ml', ...payload },
    answer,
    explanation_md: 'Cada vaso de la jarra debe llevar la misma cantidad para ser justo.',
  });

  it('flags the published beaker: 0-400 ml over 8 marks cannot be read to 250', () => {
    const seg = measureRead({ min: 0, max: 400, ticks: 8, pointer_value: 250 }, { value: 250, tolerance: 0 });
    const msg = messages(seg).find((m) => m.includes('cannot be read to 250ml'));
    expect(msg).toBeTruthy();
    expect(msg).toContain('9 (step 50)'); // the actionable fix, computed not guessed
  });

  it('accepts the same beaker once the marks line up with the pointer', () => {
    const seg = measureRead({ min: 0, max: 400, ticks: 9, pointer_value: 250 }, { value: 250, tolerance: 0 });
    expect(messages(seg).filter((m) => m.includes('measure_read'))).toHaveLength(0);
  });

  it('flags a key that grades a different value than the instrument draws (unwinnable)', () => {
    const seg = measureRead({ min: 0, max: 40, ticks: 9, pointer_value: 25 }, { value: 30, tolerance: 1 });
    expect(flagged(seg, 'reads the instrument EXACTLY RIGHT')).toBe(true);
  });

  it('flags a tolerance as wide as the step between marks (misread by a whole mark still passes)', () => {
    const seg = measureRead({ min: 0, max: 40, ticks: 9, pointer_value: 25 }, { value: 25, tolerance: 5 });
    expect(flagged(seg, 'another mark on the same dial')).toBe(true);
  });

  it('flags a pointer drawn off the scale (the renderer clamps it to the end)', () => {
    const seg = measureRead({ min: 0, max: 40, ticks: 9, pointer_value: 45 }, { value: 45, tolerance: 0 });
    expect(flagged(seg, 'outside the scale')).toBe(true);
  });

  const machineIo = (payload: Record<string, unknown>, answer: Record<string, unknown>) => ({
    id: 's1',
    type: 'machine_io',
    prompt_md: '¿Qué sale si entra 4?',
    difficulty: 1,
    xp: 10,
    payload: { examples: [{ in: 1, out: 2 }, { in: 2, out: 4 }], probe_in: 4, ...payload },
    answer,
    explanation_md: 'La máquina duplica: al meter cuatro monedas salen ocho.',
  });

  it('accepts the published machine_io (options + correct_option_id)', () => {
    const seg = machineIo(
      { options: [{ id: 'a', text_md: '6' }, { id: 'b', text_md: '8' }] },
      { correct_option_id: 'b', value: 8 },
    );
    expect(messages(seg).filter((m) => m.includes('machine_io'))).toHaveLength(0);
  });

  it('flags option cards with no keyed option (the grader reads a number that never arrives)', () => {
    const seg = machineIo({ options: [{ id: 'a', text_md: '6' }, { id: 'b', text_md: '8' }] }, { value: 8 });
    expect(flagged(seg, 'scores 0 for EVERY answer')).toBe(true);
  });

  it('flags a number-pad machine with no numeric key', () => {
    expect(flagged(machineIo({}, { correct_option_id: 'b' }), 'the grader needs a numeric answer.value')).toBe(true);
  });

  it('flags a word-output machine with no options (a number pad cannot type a word)', () => {
    const seg = machineIo({ examples: [{ in: 1, out: 'grande' }, { in: 2, out: 'chico' }] }, { value: 8 });
    expect(flagged(seg, 'only control is a number pad')).toBe(true);
  });

  it('flags a keyed option id that is not on screen', () => {
    const seg = machineIo({ options: [{ id: 'a', text_md: '6' }] }, { correct_option_id: 'zz' });
    expect(flagged(seg, 'not one of the payload.options ids')).toBe(true);
  });

  it('flags a probe that repeats an example input (the answer is already on screen)', () => {
    const seg = machineIo({ probe_in: 2, options: [{ id: 'a', text_md: '4' }] }, { correct_option_id: 'a' });
    expect(flagged(seg, 'already one of the example inputs')).toBe(true);
  });
});

describe('gate 8: arrange mechanic fit', () => {
  function arrangeDoc(seg: Record<string, unknown>) {
    const d = buildDocument();
    (d.segments as unknown as Record<string, unknown>[])[0] = seg;
    return d;
  }
  const messages = (seg: Record<string, unknown>) => runClarityGate(arrangeDoc(seg)).map((p) => p.message);
  const flagged = (seg: Record<string, unknown>, needle: string) =>
    messages(seg).some((m) => m.includes(needle));

  // ---- number_line: the child can only tap a mark on the snap grid -------------

  const numberLine = (payload: Record<string, unknown>, answer: Record<string, unknown>) => ({
    id: 's1',
    type: 'number_line',
    prompt_md: 'Toca dónde va el ahorro.',
    difficulty: 1,
    xp: 5,
    payload,
    answer,
    explanation_md: 'Liruf ahorró veinte pesos, así que va en la segunda marca de la recta.',
  });

  it('flags the shipped number-line shape: ticks 11 makes the target 20 untappable', () => {
    // step = 100/11 = 9.0909… → the child can only reach 0, 9.1, 18.2, 27.3 …
    const seg = numberLine({ min: 0, max: 100, ticks: 11, labels: true }, { value: 20, full_credit_delta: 2, zero_credit_delta: 10 });
    expect(flagged(seg, 'NOT a position the widget can express')).toBe(true);
    expect(flagged(seg, 'Use ticks: 5')).toBe(true); // 100/5 = 20 lands on 20
  });

  it('accepts the same line authored on a grid that lands on the target', () => {
    const seg = numberLine({ min: 0, max: 100, ticks: 10, labels: true }, { value: 20, full_credit_delta: 2, zero_credit_delta: 10 });
    expect(messages(seg).filter((m) => m.includes('number_line'))).toHaveLength(0);
  });

  it('accepts an unticked line (step 1) whose target is a whole number', () => {
    const seg = numberLine({ min: 0, max: 10 }, { value: 7, full_credit_delta: 0.5, zero_credit_delta: 2 });
    expect(messages(seg).filter((m) => m.includes('number_line'))).toHaveLength(0);
  });

  it('flags an unticked line whose target falls between the integer marks', () => {
    const seg = numberLine({ min: 0, max: 10 }, { value: 7.5, full_credit_delta: 0.2, zero_credit_delta: 1 });
    expect(flagged(seg, 'NOT a position the widget can express')).toBe(true);
  });

  it('flags a tolerance so wide that tapping anywhere passes', () => {
    // full_credit_delta 50 on a 0-100 line: every one of the 11 marks scores 100.
    const seg = numberLine({ min: 0, max: 100, ticks: 10 }, { value: 50, full_credit_delta: 50, zero_credit_delta: 60 });
    expect(flagged(seg, 'passes more often than not')).toBe(true);
  });

  it('does not flag a tolerance of about one tick', () => {
    // step 10; full credit within 5 → only the target mark itself passes.
    const seg = numberLine({ min: 0, max: 100, ticks: 10 }, { value: 30, full_credit_delta: 5, zero_credit_delta: 15 });
    expect(flagged(seg, 'passes more often than not')).toBe(false);
  });

  // ---- pattern_complete: the option bank must not label the answer -------------

  const patternComplete = (options: Array<Record<string, unknown>>, over: Record<string, unknown> = {}) => ({
    id: 's1',
    type: 'pattern_complete',
    prompt_md: '¿Qué sigue en el patrón?',
    difficulty: 2,
    xp: 15,
    payload: {
      sequence: [
        { icon: 'local_cafe', tint: 'primary' },
        { icon: 'nutrition', tint: 'accent' },
        { icon: 'local_cafe', tint: 'primary' },
        { icon: 'nutrition', tint: 'accent' },
      ],
      options,
      missing_slots: 1,
      ...((over.payload as Record<string, unknown>) ?? {}),
    },
    answer: { correct: { '0': 'cup' } },
    explanation_md: 'El patrón de Zara alterna vaso y limón, así que sigue el vaso.',
  });

  it('flags an option bank whose only familiar tile IS the answer', () => {
    // "tap the one I have already seen" solves an A,B,A,B,? beat with no reasoning.
    const seg = patternComplete([
      { id: 'cup', icon: 'local_cafe', tint: 'primary' },
      { id: 'star', icon: 'star', tint: 'success' },
      { id: 'moon', icon: 'bedtime', tint: 'delight' },
    ]);
    expect(flagged(seg, 'is a tile that appears in the visible sequence')).toBe(true);
  });

  it('accepts a bank whose distractors are other tiles from the same pattern', () => {
    const seg = patternComplete([
      { id: 'cup', icon: 'local_cafe', tint: 'primary' },
      { id: 'lemon', icon: 'nutrition', tint: 'accent' },
      { id: 'star', icon: 'star', tint: 'success' },
    ]);
    expect(flagged(seg, 'is a tile that appears in the visible sequence')).toBe(false);
  });

  it('flags two options that render as the same tile (icon + tint)', () => {
    const seg = patternComplete([
      { id: 'cup', icon: 'local_cafe', tint: 'primary' },
      { id: 'cup2', icon: 'local_cafe', tint: 'primary' },
      { id: 'lemon', icon: 'nutrition', tint: 'accent' },
    ]);
    expect(flagged(seg, 'the SAME icon and tint')).toBe(true);
  });

  // The build_sentence ORDER-CEILING mirror is pinned in the trivial-strategy block
  // above (the gate lives there), not duplicated here.
});

describe('gate 8: count_objects must be illustratable', () => {
  function doc(segment: Record<string, unknown>) {
    const d = buildDocument();
    (d.segments as unknown as Record<string, unknown>[])[0] = segment;
    return d;
  }

  it('flags scene items with no label — the shipped shape that produced ZERO images', () => {
    const seg = {
      id: 's1', type: 'count_objects', prompt_md: '¿Cuántas monedas hay?', difficulty: 1, xp: 10,
      payload: {
        scene: [{ icon: 'monetization_on', tint: 'primary', count: 5 }, { icon: 'cookie', tint: 'accent', count: 3 }],
        ask_icon: 'monetization_on',
      },
    };
    const problems = runClarityGate(doc(seg));
    expect(problems.some((p) => p.message.includes('no `label`'))).toBe(true);
    expect(problems.some((p) => p.message.includes('no `ask_label`'))).toBe(true);
  });

  it('accepts a fully labelled scene', () => {
    const seg = {
      id: 's1', type: 'count_objects', prompt_md: '¿Cuántas monedas hay?', difficulty: 1, xp: 10,
      payload: {
        scene: [
          { icon: 'monetization_on', tint: 'primary', count: 5, label: 'moneda' },
          { icon: 'cookie', tint: 'accent', count: 3, label: 'galleta' },
        ],
        ask_icon: 'monetization_on',
        ask_label: 'moneda',
      },
    };
    expect(runClarityGate(doc(seg)).filter((p) => p.message.includes('count_objects'))).toHaveLength(0);
  });
});
