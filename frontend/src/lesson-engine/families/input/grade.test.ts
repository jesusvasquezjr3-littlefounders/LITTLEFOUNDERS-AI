// `input` family — numeric grading tests (LESSON_ENGINE.md §5.3, §6).
// Every type: correct → 100, wrong → lower/0, malformed → 0 without throwing.

import { describe, expect, it } from 'vitest'
import type { SegmentBase } from '../../core/types'
import { evaluateTokenTexts, inputGraders } from './grade'

function seg(type: string, payload: Record<string, unknown>, answer: Record<string, unknown>): SegmentBase {
  return {
    id: `test-${type}`,
    type,
    prompt_md: 'test',
    difficulty: 1,
    xp: 10,
    payload,
    answer,
  }
}

function grade(segment: SegmentBase, answer: unknown) {
  const grader = inputGraders[segment.type]
  if (!grader) throw new Error(`no grader for ${segment.type}`)
  return grader(segment, answer)
}

const MALFORMED_ANSWERS: unknown[] = [null, undefined, 42, 'nope', [], { wrong: 'shape' }]

function expectMalformedSafe(segment: SegmentBase) {
  for (const bad of MALFORMED_ANSWERS) {
    expect(() => grade(segment, bad)).not.toThrow()
    expect(grade(segment, bad).score).toBe(0)
  }
  // Missing answer key is malformed too.
  const noKey = { ...segment, answer: undefined }
  expect(grade(noKey, { text: 'x', value: 1, gaps: {}, order: ['a', 'b', 'c'] }).score).toBe(0)
}

// ---- type_answer -----------------------------------------------------------------

describe('type_answer', () => {
  const segment = seg(
    'type_answer',
    { max_chars: 30 },
    { accept: ['alcancía', 'cochinito'], keywords: ['guardar', 'monedas'] },
  )

  it('scores 100 on an accepted answer (fuzzy, accent-stripped)', () => {
    expect(grade(segment, { text: 'alcancía' }).score).toBe(100)
    expect(grade(segment, { text: 'Alcancia' }).score).toBe(100) // accent + case
  })

  it('falls back to keyword coverage on non-accepted text', () => {
    const r = grade(segment, { text: 'sirve para guardar dinero' })
    expect(r.score).toBe(50) // 1 of 2 keywords
    const both = grade(segment, { text: 'guardar mis monedas' })
    expect(both.score).toBe(100)
  })

  it('scores 0 with no match and no keywords', () => {
    const noKeywords = seg('type_answer', { max_chars: 30 }, { accept: ['banco'] })
    expect(grade(noKeywords, { text: 'zapato' }).score).toBe(0)
  })

  it('reveals the accepted answers', () => {
    expect(grade(segment, { text: 'zzz' }).reveal).toEqual({ accept: ['alcancía', 'cochinito'] })
  })

  it('never throws on malformed answers', () => {
    expectMalformedSafe(segment)
  })

  it('accepts a digit when the key is spelled out, and vice versa (es-MX)', () => {
    const digitsKey = seg('type_answer', {}, { accept: ['5'] })
    expect(grade(digitsKey, { text: 'cinco' }).score).toBe(100)
    const wordsKey = seg('type_answer', {}, { accept: ['cinco'] })
    expect(grade(wordsKey, { text: '5' }).score).toBe(100)
  })

  it('accepts spelled-out numbers in en-US and pt-BR too', () => {
    const key = seg('type_answer', {}, { accept: ['12'] })
    expect(grade(key, { text: 'twelve' }).score).toBe(100)
    expect(grade(key, { text: 'doce' }).score).toBe(100) // es-MX and pt-BR share this word
  })

  it('handles compound tens (35) in all 3 locales', () => {
    const key = seg('type_answer', {}, { accept: ['35'] })
    expect(grade(key, { text: 'thirty-five' }).score).toBe(100)
    expect(grade(key, { text: 'treinta y cinco' }).score).toBe(100)
    expect(grade(key, { text: 'trinta e cinco' }).score).toBe(100)
  })

  it('still rejects an unrelated number word', () => {
    const key = seg('type_answer', {}, { accept: ['5'] })
    expect(grade(key, { text: 'seis' }).score).toBe(0)
  })
})

// ---- fill_blank ----------------------------------------------------------------

describe('fill_blank', () => {
  const typed = seg(
    'fill_blank',
    { text_md: 'El {{1}} guarda tu dinero y el {{2}} lo gasta.', mode: 'typed' },
    { gaps: [{ gap: 1, accept: ['ahorro'] }, { gap: 2, accept: ['gasto'] }] },
  )
  const bank = seg(
    'fill_blank',
    {
      text_md: 'Guarda {{1}} durante {{2}} semanas.',
      mode: 'bank',
      bank: [
        { id: 'b1', text_md: '$30' },
        { id: 'b2', text_md: '10' },
      ],
    },
    { gaps: [{ gap: 1, bank_id: 'b1' }, { gap: 2, bank_id: 'b2' }] },
  )

  it('typed: fuzzy-matches per gap, ratio score', () => {
    expect(grade(typed, { gaps: { '1': 'ahorro', '2': 'gasto' } }).score).toBe(100)
    expect(grade(typed, { gaps: { '1': 'ahorro', '2': 'zapato' } }).score).toBe(50)
    expect(grade(typed, { gaps: { '1': 'nada', '2': 'zapato' } }).score).toBe(0)
  })

  it('bank: exact bank_id per gap', () => {
    expect(grade(bank, { gaps: { '1': 'b1', '2': 'b2' } }).score).toBe(100)
    expect(grade(bank, { gaps: { '1': 'b2', '2': 'b1' } }).score).toBe(0)
    expect(grade(bank, { gaps: { '1': 'b1' } }).score).toBe(50)
  })

  it('reveals the correct gaps', () => {
    expect(grade(bank, { gaps: {} }).reveal).toEqual({
      gaps: [{ gap: 1, bank_id: 'b1' }, { gap: 2, bank_id: 'b2' }],
    })
  })

  it('never throws on malformed answers', () => {
    expectMalformedSafe(typed)
    expectMalformedSafe(bank)
  })

  it('typed gaps accept digit/word number equivalence too', () => {
    const numeric = seg(
      'fill_blank',
      { text_md: 'Vendiste {{1}} vasos.', mode: 'typed' },
      { gaps: [{ gap: 1, accept: ['8'] }] },
    )
    expect(grade(numeric, { gaps: { '1': 'ocho' } }).score).toBe(100)
  })
})

// ---- number_input ---------------------------------------------------------------

describe('number_input', () => {
  const segment = seg('number_input', { unit: 'pesos' }, { value: 60, tolerance: 2 })

  it('tolerance bands: 100 within tol, 50 within 2×tol, else 0', () => {
    expect(grade(segment, { value: 60 }).score).toBe(100)
    expect(grade(segment, { value: 62 }).score).toBe(100)
    expect(grade(segment, { value: 63 }).score).toBe(50)
    expect(grade(segment, { value: 64 }).score).toBe(50)
    expect(grade(segment, { value: 65 }).score).toBe(0)
  })

  it('reveals the value', () => {
    expect(grade(segment, { value: 0 }).reveal).toEqual({ value: 60 })
  })

  it('never throws on malformed answers (incl. NaN/string values)', () => {
    expectMalformedSafe(segment)
    expect(grade(segment, { value: Number.NaN }).score).toBe(0)
    expect(grade(segment, { value: '60' }).score).toBe(0)
  })
})

// ---- estimate_slider ---------------------------------------------------------------

describe('estimate_slider', () => {
  const segment = seg(
    'estimate_slider',
    { min: 0, max: 100, scale: 'linear' },
    { value: 25, full_credit_delta: 10, zero_credit_delta: 50 },
  )

  it('100 within the full-credit delta', () => {
    expect(grade(segment, { value: 25 }).score).toBe(100)
    expect(grade(segment, { value: 34 }).score).toBe(100)
  })

  it('partial credit at the falloff midpoint', () => {
    // delta 30 → halfway between full (10) and zero (50) → 50
    expect(grade(segment, { value: 55 }).score).toBe(50)
  })

  it('0 at/beyond the zero-credit delta', () => {
    expect(grade(segment, { value: 75 }).score).toBe(0)
    expect(grade(segment, { value: 100 }).score).toBe(0)
  })

  it('log scale: zero-or-negative values score 0 instead of throwing', () => {
    const log = seg(
      'estimate_slider',
      { min: 1, max: 10000, scale: 'log' },
      { value: 100, full_credit_delta: 0.5, zero_credit_delta: 2 },
    )
    expect(grade(log, { value: 100 }).score).toBe(100)
    expect(grade(log, { value: 0 }).score).toBe(0)
  })

  it('never throws on malformed answers', () => {
    expectMalformedSafe(segment)
  })
})

// ---- count_objects ------------------------------------------------------------------

describe('count_objects', () => {
  const segment = seg(
    'count_objects',
    { scene: [{ icon: 'paid', count: 7 }], ask_icon: 'paid' },
    { value: 7 },
  )

  it('exact count → 100', () => {
    expect(grade(segment, { value: 7 }).score).toBe(100)
  })

  it('off by one → 40 (young-kid tolerance)', () => {
    expect(grade(segment, { value: 6 }).score).toBe(40)
    expect(grade(segment, { value: 8 }).score).toBe(40)
  })

  it('off by more → 0', () => {
    expect(grade(segment, { value: 5 }).score).toBe(0)
    expect(grade(segment, { value: 20 }).score).toBe(0)
  })

  it('reveals the value and never throws on malformed answers', () => {
    expect(grade(segment, { value: 0 }).reveal).toEqual({ value: 7 })
    expectMalformedSafe(segment)
  })
})

// ---- equation_builder ---------------------------------------------------------------

describe('equation_builder', () => {
  const segment = seg(
    'equation_builder',
    {
      tokens: [
        { id: 't1', text: '4' },
        { id: 't2', text: '×' },
        { id: 't3', text: '5' },
        { id: 't4', text: '+' },
        { id: 't5', text: '9' },
        { id: 't6', text: '2' },
      ],
      slots: 5,
      target_result: 20,
    },
    { accepted: ['4 × 5', '5 × 4'] },
  )

  it('100 via the accepted-order path (spaces ignored)', () => {
    expect(grade(segment, { order: ['t1', 't2', 't3'] }).score).toBe(100) // "4×5"
    expect(grade(segment, { order: ['t3', 't2', 't1'] }).score).toBe(100) // "5×4"
  })

  it('100 via the evaluation path when not listed in accepted', () => {
    // 9 + 2 + 9? not possible (ids unique) — use 9 × 2 + 2? also dup. Use: 4 × 5 is accepted,
    // so exercise evaluation with "2 + 9 + 4 + 5" = 20 (ids t6,t4,t5 … needs two "+").
    // With one "+" available: "9 + 2" = 11 ≠ 20; instead verify against a wider segment:
    const wide = seg(
      'equation_builder',
      {
        tokens: [
          { id: 'a', text: '12' },
          { id: 'b', text: '+' },
          { id: 'c', text: '8' },
        ],
        slots: 3,
        target_result: 20,
      },
      { accepted: ['4 × 5'] }, // "12 + 8" is NOT listed — must pass by evaluating to 20
    )
    expect(grade(wide, { order: ['a', 'b', 'c'] }).score).toBe(100)
  })

  it('respects × ÷ precedence in the evaluator', () => {
    // 2 + 9 × 2 = 20 (not 22): precedence multiplies first.
    const prec = seg(
      'equation_builder',
      {
        tokens: [
          { id: 'a', text: '2' },
          { id: 'b', text: '+' },
          { id: 'c', text: '9' },
          { id: 'd', text: '×' },
          { id: 'e', text: '2' },
        ],
        slots: 5,
        target_result: 20,
      },
      { accepted: ['9 × 2 + 2'] },
    )
    expect(grade(prec, { order: ['a', 'b', 'c', 'd', 'e'] }).score).toBe(100)
  })

  it('0 when the built equation misses the target', () => {
    expect(grade(segment, { order: ['t5', 't4', 't6'] }).score).toBe(0) // 9 + 2 = 11
  })

  it('malformed sequences score 0: leading/trailing/adjacent operators', () => {
    expect(grade(segment, { order: ['t2', 't1', 't3'] }).score).toBe(0) // × 4 5
    expect(grade(segment, { order: ['t1', 't3', 't2'] }).score).toBe(0) // 4 5 ×
    expect(grade(segment, { order: ['t1', 't2', 't4', 't3'] }).score).toBe(0) // 4 × + 5
  })

  it('duplicate or unknown token ids score 0', () => {
    expect(grade(segment, { order: ['t1', 't1', 't3'] }).score).toBe(0)
    expect(grade(segment, { order: ['t1', 't2', 'ghost'] }).score).toBe(0)
  })

  it('reveals accepted and never throws on malformed answers', () => {
    expect(grade(segment, { order: ['t5', 't4', 't6'] }).reveal).toEqual({ accepted: ['4 × 5', '5 × 4'] })
    expectMalformedSafe(segment)
  })
})

// ---- evaluateTokenTexts (the tiny safe evaluator) -----------------------------------

describe('evaluateTokenTexts', () => {
  it('evaluates with standard precedence', () => {
    expect(evaluateTokenTexts(['2', '+', '3', '×', '4'])).toBe(14)
    expect(evaluateTokenTexts(['10', '-', '6', '÷', '2'])).toBe(7)
    expect(evaluateTokenTexts(['8', '*', '2'])).toBe(16)
    expect(evaluateTokenTexts(['7'])).toBe(7)
  })

  it('returns null on malformed sequences', () => {
    expect(evaluateTokenTexts([])).toBeNull()
    expect(evaluateTokenTexts(['+', '2', '3'])).toBeNull() // leading operator
    expect(evaluateTokenTexts(['2', '3', '+'])).toBeNull() // trailing operator
    expect(evaluateTokenTexts(['2', '+', '+', '3'])).toBeNull() // adjacent operators
    expect(evaluateTokenTexts(['2', '2'])).toBeNull() // adjacent numbers
    expect(evaluateTokenTexts(['2', '+', 'gato'])).toBeNull() // unknown token
  })

  it('returns null on division by zero', () => {
    expect(evaluateTokenTexts(['5', '÷', '0'])).toBeNull()
    expect(evaluateTokenTexts(['5', '/', '0'])).toBeNull()
  })
})
