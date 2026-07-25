// `arrange` family — numeric grading tests (LESSON_ENGINE.md §5.4, §6).
// Per type: perfect → 100, partial → exact expected value, malformed → 0 without throwing.

import { describe, expect, it } from 'vitest'
import type { SegmentBase } from '../../core/types'
import { arrangeGraders } from './grade'

function seg(
  type: string,
  payload: Record<string, unknown>,
  answer?: Record<string, unknown>,
): SegmentBase {
  return {
    id: `test-${type}`,
    type,
    prompt_md: 'test',
    difficulty: 1,
    xp: 10,
    payload,
    ...(answer ? { answer } : {}),
  }
}

function grade(segment: SegmentBase, answer: unknown): number {
  const grader = arrangeGraders[segment.type]
  if (!grader) throw new Error(`no grader for ${segment.type}`)
  return grader(segment, answer).score
}

const MALFORMED_ANSWERS: unknown[] = [undefined, null, 42, 'nope', [], {}]

function expectMalformedZero(segment: SegmentBase) {
  MALFORMED_ANSWERS.forEach((bad) => {
    expect(() => grade(segment, bad)).not.toThrow()
    expect(grade(segment, bad)).toBe(0)
  })
}

// ---- match_pairs -----------------------------------------------------------------

describe('match_pairs', () => {
  const segment = seg(
    'match_pairs',
    {
      left: [
        { id: 'l1', text_md: 'a' },
        { id: 'l2', text_md: 'b' },
        { id: 'l3', text_md: 'c' },
      ],
      right: [
        { id: 'r1', text_md: 'x' },
        { id: 'r2', text_md: 'y' },
        { id: 'r3', text_md: 'z' },
        { id: 'r4', text_md: 'distractor' },
      ],
    },
    { pairs: [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']] },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { pairs: [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']] })).toBe(100)
  })

  it('1 of 3 pairs right → 33', () => {
    expect(grade(segment, { pairs: [['l1', 'r1'], ['l2', 'r3'], ['l3', 'r2']] })).toBe(33)
  })

  it('picking a distractor costs the pair', () => {
    expect(grade(segment, { pairs: [['l1', 'r4'], ['l2', 'r2'], ['l3', 'r3']] })).toBe(67)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { pairs: [['l1']] })).toBe(0)
    expect(grade(segment, { pairs: 'l1,r1' })).toBe(0)
  })

  it('missing answer key → 0', () => {
    const noKey = seg('match_pairs', segment.payload)
    expect(grade(noKey, { pairs: [['l1', 'r1']] })).toBe(0)
  })
})

// ---- memory_flip (derived, no answer key) --------------------------------------------

describe('memory_flip', () => {
  const segment = seg('memory_flip', {
    pairs: [
      { a_md: 'a', b_md: '1' },
      { a_md: 'b', b_md: '2' },
      { a_md: 'c', b_md: '3' },
    ],
  })

  it('any completion → 100 — the component only submits once every pair is matched', () => {
    expect(grade(segment, { flips: 6, pairs: 3 })).toBe(100)
    expect(grade(segment, { flips: 8, pairs: 3 })).toBe(100)
  })

  it('extra flips never lower the score — finishing the board IS the win', () => {
    expect(grade(segment, { flips: 10, pairs: 3 })).toBe(100)
    expect(grade(segment, { flips: 14, pairs: 3 })).toBe(100)
    expect(grade(segment, { flips: 100, pairs: 3 })).toBe(100)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { flips: -1, pairs: 3 })).toBe(0)
    expect(grade(segment, { flips: 'many' })).toBe(0)
  })
})

// ---- sort_buckets --------------------------------------------------------------------

describe('sort_buckets', () => {
  const segment = seg(
    'sort_buckets',
    {
      buckets: [
        { id: 'b1', label: 'A' },
        { id: 'b2', label: 'B' },
      ],
      items: [
        { id: 'i1', text_md: '1' },
        { id: 'i2', text_md: '2' },
        { id: 'i3', text_md: '3' },
        { id: 'i4', text_md: '4' },
      ],
    },
    { assignments: { i1: 'b1', i2: 'b1', i3: 'b2', i4: 'b2' } },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { assignments: { i1: 'b1', i2: 'b1', i3: 'b2', i4: 'b2' } })).toBe(100)
  })

  it('2 of 4 right → 50', () => {
    expect(grade(segment, { assignments: { i1: 'b1', i2: 'b2', i3: 'b1', i4: 'b2' } })).toBe(50)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { assignments: { i1: 7 } })).toBe(0)
  })
})

// ---- order_steps (Kendall) --------------------------------------------------------------

describe('order_steps', () => {
  const segment = seg(
    'order_steps',
    {
      items: [
        { id: 'a', text_md: 'a' },
        { id: 'b', text_md: 'b' },
        { id: 'c', text_md: 'c' },
        { id: 'd', text_md: 'd' },
      ],
    },
    { order: ['a', 'b', 'c', 'd'] },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { order: ['a', 'b', 'c', 'd'] })).toBe(100)
  })

  it('one adjacent swap → 83 (5 of 6 concordant pairs)', () => {
    expect(grade(segment, { order: ['b', 'a', 'c', 'd'] })).toBe(83)
  })

  it('full reversal → 0', () => {
    expect(grade(segment, { order: ['d', 'c', 'b', 'a'] })).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { order: ['a', 'a', 'c', 'd'] })).toBe(0) // duplicates
    expect(grade(segment, { order: ['a', 'b'] })).toBe(0) // wrong length
    expect(grade(segment, { order: ['a', 'b', 'c', 'zz'] })).toBe(0) // unknown id
  })
})

// ---- accept_orders (multi-order acceptance) ---------------------------------------------

describe('order accepts a SET of valid orderings (accept_orders)', () => {
  // Two genuinely-swappable first steps: [a,b,...] and [b,a,...] are both correct.
  const segment = seg(
    'order_steps',
    { items: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }, { id: 'c', text_md: 'c' }] },
    { order: ['a', 'b', 'c'], accept_orders: [['b', 'a', 'c']] },
  )

  it('the primary order → 100', () => {
    expect(grade(segment, { order: ['a', 'b', 'c'] })).toBe(100)
  })

  it('the alternative accepted order → 100 (no longer marked wrong)', () => {
    expect(grade(segment, { order: ['b', 'a', 'c'] })).toBe(100)
  })

  it('a genuinely-wrong order still scores below 100', () => {
    expect(grade(segment, { order: ['c', 'b', 'a'] })).toBeLessThan(100)
  })

  it('build_sentence accepts an alternative phrasing', () => {
    const bs = seg(
      'build_sentence',
      { tokens: [{ id: 't1', text_md: '2 vasos' }, { id: 't2', text_md: 'por' }, { id: 't3', text_md: '10 pesos' }], slots: 3 },
      { order: ['t1', 't2', 't3'], accept_orders: [['t3', 't2', 't1']] },
    )
    expect(grade(bs, { order: ['t1', 't2', 't3'] })).toBe(100)
    expect(grade(bs, { order: ['t3', 't2', 't1'] })).toBe(100)
  })
})

// ---- rank_choices (footrule) ---------------------------------------------------------------

describe('rank_choices', () => {
  const segment = seg(
    'rank_choices',
    {
      criterion_md: 'most urgent first',
      items: [
        { id: 'a', text_md: 'a' },
        { id: 'b', text_md: 'b' },
        { id: 'c', text_md: 'c' },
        { id: 'd', text_md: 'd' },
      ],
    },
    { order: ['a', 'b', 'c', 'd'] },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { order: ['a', 'b', 'c', 'd'] })).toBe(100)
  })

  it('one adjacent swap → 75 (displacement 2 of max 8)', () => {
    expect(grade(segment, { order: ['b', 'a', 'c', 'd'] })).toBe(75)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
  })
})

// ---- build_sentence (positional) --------------------------------------------------------------

describe('build_sentence', () => {
  const segment = seg(
    'build_sentence',
    {
      tokens: [
        { id: 'a', text_md: 'a' },
        { id: 'b', text_md: 'b' },
        { id: 'c', text_md: 'c' },
        { id: 'x', text_md: 'distractor' },
      ],
      slots: 3,
    },
    { order: ['a', 'b', 'c'] },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { order: ['a', 'b', 'c'] })).toBe(100)
  })

  it('distractor in one slot → 67 (2 of 3 positions)', () => {
    expect(grade(segment, { order: ['a', 'x', 'c'] })).toBe(67)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { order: ['a', 'b'] })).toBe(0) // wrong length
  })
})

// ---- timeline_order (positional) -----------------------------------------------------------------

describe('timeline_order', () => {
  const segment = seg(
    'timeline_order',
    {
      events: [
        { id: 'e1', text_md: '1' },
        { id: 'e2', text_md: '2' },
        { id: 'e3', text_md: '3' },
        { id: 'e4', text_md: '4' },
      ],
    },
    { order: ['e1', 'e2', 'e3', 'e4'] },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { order: ['e1', 'e2', 'e3', 'e4'] })).toBe(100)
  })

  it('first two swapped → 50 (2 of 4 positions)', () => {
    expect(grade(segment, { order: ['e2', 'e1', 'e3', 'e4'] })).toBe(50)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
  })
})

// ---- pattern_complete ---------------------------------------------------------------------------

describe('pattern_complete', () => {
  const segment = seg(
    'pattern_complete',
    {
      sequence: [
        { icon: 'paid', tint: 'warning' },
        { icon: 'payments', tint: 'success' },
      ],
      options: [
        { id: 'o1', icon: 'paid', tint: 'warning' },
        { id: 'o2', icon: 'payments', tint: 'success' },
        { id: 'o3', icon: 'savings', tint: 'primary' },
      ],
      missing_slots: 2,
    },
    { correct: { '0': 'o1', '1': 'o2' } },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { placed: { '0': 'o1', '1': 'o2' } })).toBe(100)
  })

  it('1 of 2 slots right → 50', () => {
    expect(grade(segment, { placed: { '0': 'o1', '1': 'o3' } })).toBe(50)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { placed: { '0': 3 } })).toBe(0)
  })
})

// ---- group_sets ------------------------------------------------------------------------------------

describe('group_sets', () => {
  const segment = seg(
    'group_sets',
    {
      set_a: 'A',
      set_b: 'B',
      items: [
        { id: 'g1', text_md: '1' },
        { id: 'g2', text_md: '2' },
        { id: 'g3', text_md: '3' },
        { id: 'g4', text_md: '4' },
      ],
    },
    { zones: { g1: 'a', g2: 'b', g3: 'both', g4: 'none' } },
  )

  it('perfect → 100', () => {
    expect(grade(segment, { zones: { g1: 'a', g2: 'b', g3: 'both', g4: 'none' } })).toBe(100)
  })

  it('3 of 4 right → 75', () => {
    expect(grade(segment, { zones: { g1: 'a', g2: 'b', g3: 'a', g4: 'none' } })).toBe(75)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { zones: { g1: 'left' } })).toBe(0) // invalid zone id
  })
})

// ---- number_line -------------------------------------------------------------------------------------

describe('number_line', () => {
  const segment = seg(
    'number_line',
    { min: 0, max: 100, ticks: 20 },
    { value: 50, full_credit_delta: 5, zero_credit_delta: 20 },
  )

  it('within full-credit delta → 100', () => {
    expect(grade(segment, { value: 50 })).toBe(100)
    expect(grade(segment, { value: 52 })).toBe(100)
  })

  it('linear falloff between deltas → 67 at delta 10', () => {
    // (1 − (10 − 5) / (20 − 5)) · 100 = 66.67 → 67
    expect(grade(segment, { value: 60 })).toBe(67)
  })

  it('at/beyond zero-credit delta → 0', () => {
    expect(grade(segment, { value: 80 })).toBe(0)
    expect(grade(segment, { value: 70 })).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(segment)
    expect(grade(segment, { value: 'fifty' })).toBe(0)
    expect(grade(segment, { value: Number.NaN })).toBe(0)
  })
})
