// `money` family — numeric grader tests (LESSON_ENGINE.md §5.5, §6).
// Per type: correct → 100, near/partial → expected band, malformed → 0 without throwing.

import { describe, expect, it } from 'vitest'
import type { SegmentBase } from '../../core/types'
import { moneyGraders } from './grade'
import { moneyFixtures } from './fixtures'
import { moneySchemas } from './schema'

function seg(type: string, payload: Record<string, unknown>, answer?: Record<string, unknown>): SegmentBase {
  return { id: `t-${type}`, type, prompt_md: 'x', difficulty: 1, xp: 10, payload, answer }
}

function grade(type: string, segment: SegmentBase, answer: unknown) {
  const grader = moneyGraders[type]
  if (!grader) throw new Error(`missing grader: ${type}`)
  return grader(segment, answer)
}

const MALFORMED_ANSWERS: unknown[] = [undefined, null, 42, 'nope', [], {}, { junk: true }]

describe('coin_count', () => {
  const segment = seg('coin_count', { currency: 'MXN', denominations: [1, 2, 5, 10, 20, 50], target: 37 })

  it('exact sum (any combo) → 100', () => {
    expect(grade('coin_count', segment, { picked: [20, 10, 5, 2] }).score).toBe(100)
    expect(grade('coin_count', segment, { picked: [10, 10, 10, 5, 2] }).score).toBe(100)
  })

  it('within the smallest denomination → 40 (near band)', () => {
    expect(grade('coin_count', segment, { picked: [20, 10, 5, 1] }).score).toBe(40) // 36
    expect(grade('coin_count', segment, { picked: [20, 10, 5, 2, 1] }).score).toBe(40) // 38
  })

  it('further off → 0', () => {
    expect(grade('coin_count', segment, { picked: [20, 20] }).score).toBe(0)
  })

  it('reveals the target', () => {
    expect(grade('coin_count', segment, { picked: [20, 10, 5, 2] }).reveal).toEqual({ target: 37 })
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('coin_count', segment, bad).score).toBe(0)
    }
    expect(grade('coin_count', segment, { picked: ['20', 10] }).score).toBe(0)
  })
})

describe('make_change', () => {
  const segment = seg('make_change', {
    currency: 'MXN',
    denominations: [1, 2, 5, 10, 20, 50],
    price: 68,
    paid_with: 100,
  })

  it('exact change (paid_with − price = 32) → 100', () => {
    expect(grade('make_change', segment, { picked: [20, 10, 2] }).score).toBe(100)
  })

  it('within smallest denomination → 40', () => {
    expect(grade('make_change', segment, { picked: [20, 10, 1] }).score).toBe(40) // 31
  })

  it('wrong change → 0', () => {
    expect(grade('make_change', segment, { picked: [50] }).score).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('make_change', segment, bad).score).toBe(0)
    }
  })
})

describe('piggy_split', () => {
  const segment = seg(
    'piggy_split',
    {
      income: 100,
      unit: 'MXN',
      jars: [
        { id: 'save', label: 'Ahorrar', icon: 'savings' },
        { id: 'spend', label: 'Gastar', icon: 'shopping_cart' },
        { id: 'share', label: 'Compartir', icon: 'redeem' },
      ],
      step: 10,
    },
    {
      targets: { save: { min: 30, max: 60 }, spend: { min: 20, max: 50 }, share: { min: 10, max: 30 } },
    },
  )

  it('all jars in range (sums to income) → 100', () => {
    expect(grade('piggy_split', segment, { alloc: { save: 40, spend: 40, share: 20 } }).score).toBe(100)
  })

  // EXPECTATION CHANGED (partial_credit_too_generous, 2026-07-25): allocationRanges
  // no longer pays inRange/jars × 100 for an incomplete split — at 4 jars that gave
  // 75 for a plan with one jar wrong, which passed the 70 gate. Partial credit is
  // now capped inside a sub-pass band, so 2 of 3 reads 33 instead of 67. It failed
  // before and still fails; only the reported closeness moved.
  it('2 of 3 jars in range → 33 (partial credit, capped below any pass gate)', () => {
    expect(grade('piggy_split', segment, { alloc: { save: 70, spend: 20, share: 10 } }).score).toBe(33)
  })

  it('one jar of FOUR out of range → 38, not a pass (was 75 under ratio credit)', () => {
    const fourJars = seg(
      'piggy_split',
      {
        income: 100,
        unit: 'MXN',
        jars: [
          { id: 'save', label: 'Ahorrar', icon: 'savings' },
          { id: 'spend', label: 'Gastar', icon: 'shopping_cart' },
          { id: 'share', label: 'Compartir', icon: 'redeem' },
          { id: 'grow', label: 'Hacer crecer', icon: 'trending_up' },
        ],
        step: 10,
      },
      {
        targets: {
          save: { min: 20, max: 40 },
          spend: { min: 20, max: 40 },
          share: { min: 5, max: 20 },
          grow: { min: 5, max: 20 },
        },
      },
    )
    // Intended split still scores a clean 100 — never unwinnable.
    expect(grade('piggy_split', fourJars, { alloc: { save: 30, spend: 30, share: 20, grow: 20 } }).score).toBe(100)
    // `grow` left empty (the misconception the jars teach against) → below the gate.
    expect(grade('piggy_split', fourJars, { alloc: { save: 40, spend: 40, share: 20, grow: 0 } }).score).toBe(38)
  })

  it('allocation does not sum to income → 0', () => {
    expect(grade('piggy_split', segment, { alloc: { save: 10, spend: 10, share: 10 } }).score).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('piggy_split', segment, bad).score).toBe(0)
    }
    expect(grade('piggy_split', segment, { alloc: { save: 'all' } }).score).toBe(0)
  })
})

describe('needs_wants', () => {
  const segment = seg(
    'needs_wants',
    {
      items: [
        { id: 'water', text_md: 'Agua' },
        { id: 'game', text_md: 'Videojuego' },
        { id: 'shoes', text_md: 'Zapatos' },
        { id: 'candy', text_md: 'Dulces' },
      ],
    },
    { needs_ids: ['water', 'shoes'] },
  )

  it('all decisions right → 100', () => {
    expect(grade('needs_wants', segment, { needs_ids: ['water', 'shoes'] }).score).toBe(100)
  })

  it('one need missed → 75 (decision accuracy 3/4)', () => {
    expect(grade('needs_wants', segment, { needs_ids: ['water'] }).score).toBe(75)
  })

  it('everything inverted → 0', () => {
    expect(grade('needs_wants', segment, { needs_ids: ['game', 'candy'] }).score).toBe(0)
  })

  it('blanket "Want on everything" scores 50 even on a needs-poor set (was a pass)', () => {
    /*
     * naive_strategy_passes: buildNeedsWantsAnswer encodes "Want" as absence, so
     * tapping Want on every card submits an EMPTY needs_ids. Under plain decision
     * accuracy that scored (N−P)/N — 75 here (6 wants of 8) — and cleared the 70
     * threshold with no needs-vs-wants thinking. Balanced accuracy pins it at 50.
     */
    const needsPoor = seg(
      'needs_wants',
      {
        items: [
          { id: 'water', text_md: 'Agua' },
          { id: 'shoes', text_md: 'Zapatos' },
          { id: 'game', text_md: 'Videojuego' },
          { id: 'candy', text_md: 'Dulces' },
          { id: 'sticker', text_md: 'Calcomanías' },
          { id: 'toy', text_md: 'Juguete' },
          { id: 'cap', text_md: 'Gorra' },
          { id: 'soda', text_md: 'Refresco' },
        ],
      },
      { needs_ids: ['water', 'shoes'] },
    )
    expect(grade('needs_wants', needsPoor, { needs_ids: [] }).score).toBe(50)
    // Mirror strategy — "Need on everything" — is equally worthless.
    expect(
      grade('needs_wants', needsPoor, {
        needs_ids: ['water', 'shoes', 'game', 'candy', 'sticker', 'toy', 'cap', 'soda'],
      }).score,
    ).toBe(50)
    // The reasoned answer is still exactly 100, and one slip still passes on merit.
    expect(grade('needs_wants', needsPoor, { needs_ids: ['water', 'shoes'] }).score).toBe(100)
    expect(grade('needs_wants', needsPoor, { needs_ids: ['water', 'shoes', 'cap'] }).score).toBe(92)
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('needs_wants', segment, bad).score).toBe(0)
    }
  })
})

describe('price_compare', () => {
  const segment = seg(
    'price_compare',
    {
      offers: [
        { id: 'small', label: 'Chico', qty: 3, unit: 'jugos', price: 30 },
        { id: 'big', label: 'Grande', qty: 6, unit: 'jugos', price: 51 },
      ],
      currency: 'MXN',
    },
    { best_offer_id: 'big' },
  )

  it('best offer chosen → 100, with numeric unit prices in reveal', () => {
    const outcome = grade('price_compare', segment, { offer_id: 'big' })
    expect(outcome.score).toBe(100)
    expect(outcome.reveal).toEqual({
      best_offer_id: 'big',
      unit_prices: { small: 10, big: 8.5 },
    })
  })

  it('worse offer chosen → 0', () => {
    expect(grade('price_compare', segment, { offer_id: 'small' }).score).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('price_compare', segment, bad).score).toBe(0)
    }
  })
})

describe('budget_fit', () => {
  const segment = seg('budget_fit', {
    budget: 100,
    currency: 'MXN',
    items: [
      { id: 'n1', label: 'Lonche', icon: 'lunch_dining', price: 30, need: true },
      { id: 'n2', label: 'Lápices', icon: 'school', price: 25, need: true },
      { id: 'w1', label: 'Juego', icon: 'sports_esports', price: 40 },
      { id: 'w2', label: 'Helado', icon: 'icecream', price: 50 },
      { id: 'w3', label: 'Stickers', icon: 'sell', price: 30 },
    ],
    must_buy_needs: true,
  })

  it('within budget with all needs → 100', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['n1', 'n2', 'w3'] }).score).toBe(100) // 85
    expect(grade('budget_fit', segment, { selected_ids: ['n1', 'n2', 'w1'] }).score).toBe(100) // 95
  })

  it('over budget by ≤10% with all needs → 50', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['n1', 'n2', 'w2'] }).score).toBe(50) // 105
  })

  it('exactly one need missed, within budget → 50', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['n1', 'w3'] }).score).toBe(50) // 60, n2 missed
  })

  it('both lapses at once (over ≤10% AND one need missed) → 0 (XOR)', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['n2', 'w2', 'w3'] }).score).toBe(0) // 105, n1 missed
  })

  it('grossly over budget with one need missed → 0 (not a mild lapse)', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['n2', 'w1', 'w2'] }).score).toBe(0) // 115, n1 missed
  })

  it('grossly over budget → 0 even with needs covered', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['n1', 'n2', 'w1', 'w2'] }).score).toBe(0) // 145
  })

  it('two needs missed → 0 even within budget', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['w1', 'w3'] }).score).toBe(0) // 55
  })

  it('reveals budget and needs ids', () => {
    expect(grade('budget_fit', segment, { selected_ids: ['n1', 'n2'] }).reveal).toEqual({
      budget: 100,
      needs_ids: ['n1', 'n2'],
    })
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('budget_fit', segment, bad).score).toBe(0)
    }
  })
})

describe('savings_goal', () => {
  it('weeks = ceil(goal / weekly): goal 100, weekly 30 → 4', () => {
    const segment = seg('savings_goal', { goal: 100, currency: 'MXN', weekly_options: [30] })
    expect(grade('savings_goal', segment, { weeks: { '30': 4 } }).score).toBe(100)
    expect(grade('savings_goal', segment, { weeks: { '30': 3 } }).score).toBe(0)
  })

  const segment = seg('savings_goal', { goal: 120, currency: 'MXN', weekly_options: [10, 20, 40] })

  it('all exact → 100 and reveals the correct table', () => {
    const outcome = grade('savings_goal', segment, { weeks: { '10': 12, '20': 6, '40': 3 } })
    expect(outcome.score).toBe(100)
    expect(outcome.reveal).toEqual({ correct: { '10': 12, '20': 6, '40': 3 } })
  })

  it('2 of 3 exact → 67 (ratio of exact answers)', () => {
    expect(grade('savings_goal', segment, { weeks: { '10': 12, '20': 6, '40': 4 } }).score).toBe(67)
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('savings_goal', segment, bad).score).toBe(0)
    }
    expect(grade('savings_goal', segment, { weeks: { '10': 'doce' } }).score).toBe(0)
  })
})

describe('fair_trade', () => {
  const segment = seg(
    'fair_trade',
    {
      offer_a: { label: 'Stickers', icon: 'sell', qty: 5 },
      offer_b: { label: 'Canicas', icon: 'toys', qty: 10 },
      rate_md: '1 sticker vale **2 canicas**.',
    },
    { verdict: 'fair' },
  )

  it('correct verdict → 100', () => {
    expect(grade('fair_trade', segment, { verdict: 'fair' }).score).toBe(100)
  })

  it('wrong verdict → 0', () => {
    expect(grade('fair_trade', segment, { verdict: 'a_wins' }).score).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('fair_trade', segment, bad).score).toBe(0)
    }
    expect(grade('fair_trade', segment, { verdict: 'nobody' }).score).toBe(0)
  })
})

describe('interest_peek', () => {
  const choiceSegment = seg(
    'interest_peek',
    {
      principal: 100,
      rate_pct: 10,
      periods: 5,
      currency: 'MXN',
      prediction: {
        kind: 'choice',
        options: [
          { id: 'a', text_md: 'Menos de $150' },
          { id: 'b', text_md: 'Más de $150' },
        ],
      },
    },
    { correct_option_id: 'b' },
  )

  it('choice prediction → binary', () => {
    expect(grade('interest_peek', choiceSegment, { option_id: 'b' }).score).toBe(100)
    expect(grade('interest_peek', choiceSegment, { option_id: 'a' }).score).toBe(0)
  })

  const sliderSegment = seg(
    'interest_peek',
    {
      principal: 100,
      rate_pct: 10,
      periods: 5,
      currency: 'MXN',
      prediction: { kind: 'slider', min: 100, max: 300 },
    },
    { value: 200 }, // no tolerance authored → defaults to 5% of value = 10
  )

  it('slider prediction → tolerance bands with default 5% tolerance', () => {
    expect(grade('interest_peek', sliderSegment, { value: 205 }).score).toBe(100) // within 10
    expect(grade('interest_peek', sliderSegment, { value: 215 }).score).toBe(50) // within 2×10
    expect(grade('interest_peek', sliderSegment, { value: 230 }).score).toBe(0)
  })

  it('authored tolerance wins over the default', () => {
    const tight = seg(
      'interest_peek',
      sliderSegment.payload,
      { value: 200, tolerance: 2 },
    )
    expect(grade('interest_peek', tight, { value: 205 }).score).toBe(0)
    expect(grade('interest_peek', tight, { value: 201 }).score).toBe(100)
  })

  it('malformed → 0, never throws', () => {
    for (const bad of MALFORMED_ANSWERS) {
      expect(grade('interest_peek', choiceSegment, bad).score).toBe(0)
      expect(grade('interest_peek', sliderSegment, bad).score).toBe(0)
    }
    expect(grade('interest_peek', sliderSegment, { value: 'mucho' }).score).toBe(0)
  })
})

describe('fixtures', () => {
  // Fixtures are built per locale now (lab/fixtureCopy.ts); the SHAPE is the
  // same in all three by construction and registry.test.tsx proves it, so one
  // locale is enough here.
  const fixtures = moneyFixtures('en-US')

  it('every fixture parses against its Zod schema', () => {
    for (const fixture of fixtures) {
      const schema = moneySchemas.find((s) => s.shape.type.value === fixture.type)
      expect(schema, `schema for ${fixture.type}`).toBeDefined()
      const result = schema!.safeParse(fixture)
      expect(result.success, `${fixture.id}: ${result.success ? '' : JSON.stringify(result.error.issues)}`).toBe(true)
    }
  })

  it('covers all 9 money types exactly once', () => {
    expect(fixtures.map((f) => f.type).sort()).toEqual(Object.keys(moneyGraders).sort())
  })
})

describe('registry completeness', () => {
  it('all 9 money types have a grader', () => {
    expect(Object.keys(moneyGraders).sort()).toEqual([
      'budget_fit',
      'coin_count',
      'fair_trade',
      'interest_peek',
      'make_change',
      'needs_wants',
      'piggy_split',
      'price_compare',
      'savings_goal',
    ])
  })
})
