// `money` family — pure validators (LESSON_ENGINE.md §5.5, §6).
// Malformed answers → score 0, never throw. This module is react-free: any
// currency FORMATTING happens in the components (Intl); here we only compute
// numbers and put them in `reveal` for the renderer to localize.

import type { FamilyGrader, GradeOutcome } from '../../core/types'
import { binary, decisionAccuracy, ratio, sumEquals, toleranceBands, allocationRanges } from '../../core/scoring'

type Dict = Record<string, unknown>

function obj(v: unknown): Dict | null {
  return typeof v === 'object' && v !== null ? (v as Dict) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null
}

function numArray(v: unknown): number[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x))
    ? (v as number[])
    : null
}

function numRecord(v: unknown): Record<string, number> | null {
  const o = obj(v)
  if (!o) return null
  return Object.values(o).every((x) => typeof x === 'number' && Number.isFinite(x))
    ? (o as Record<string, number>)
    : null
}

const MALFORMED: GradeOutcome = { score: 0 }

// ---- coin_count / make_change (shared tray sum check) --------------------------

function gradeTraySum(picked: number[] | null, target: number | null, denominations: number[] | null): GradeOutcome {
  if (!picked || target === null || !denominations || denominations.length === 0) return MALFORMED
  const sum = picked.reduce((acc, v) => acc + v, 0)
  const minDenomination = Math.min(...denominations)
  return { score: sumEquals(sum, target, minDenomination), reveal: { target } }
}

const gradeCoinCount: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  return gradeTraySum(
    a ? numArray(a.picked) : null,
    num(segment.payload.target),
    numArray(segment.payload.denominations),
  )
}

const gradeMakeChange: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const price = num(segment.payload.price)
  const paidWith = num(segment.payload.paid_with)
  const target = price !== null && paidWith !== null ? paidWith - price : null
  return gradeTraySum(a ? numArray(a.picked) : null, target, numArray(segment.payload.denominations))
}

// ---- piggy_split ----------------------------------------------------------------

const gradePiggySplit: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const alloc = a ? numRecord(a.alloc) : null
  const key = obj(segment.answer)
  const rawTargets = key ? obj(key.targets) : null
  const income = num(segment.payload.income)
  if (!alloc || !rawTargets || income === null) return MALFORMED
  const targets: Record<string, { min: number; max: number }> = {}
  for (const [jarId, range] of Object.entries(rawTargets)) {
    const r = obj(range)
    const min = r ? num(r.min) : null
    const max = r ? num(r.max) : null
    if (min === null || max === null) return MALFORMED
    targets[jarId] = { min, max }
  }
  return {
    score: allocationRanges(alloc, targets, income),
    feedback_md: key && typeof key.rationale_md === 'string' ? key.rationale_md : undefined,
    reveal: { targets },
  }
}

// ---- needs_wants ------------------------------------------------------------------

const gradeNeedsWants: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const selected = a ? strArray(a.needs_ids) : null
  const positives = key ? strArray(key.needs_ids) : null
  const items = segment.payload.items as Array<{ id: string }> | undefined
  if (!selected || !positives || !Array.isArray(items)) return MALFORMED
  return {
    score: decisionAccuracy(selected, positives, items.map((i) => i.id)),
    reveal: { needs_ids: positives },
  }
}

// ---- price_compare ---------------------------------------------------------------

const gradePriceCompare: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const chosen = a ? str(a.offer_id) : null
  const best = key ? str(key.best_offer_id) : null
  const offers = segment.payload.offers as Array<{ id: string; qty: number; price: number }> | undefined
  if (!chosen || !best || !Array.isArray(offers)) return MALFORMED
  // Numbers only — the component renders them localized (Intl + i18n keys).
  const unitPrices: Record<string, number> = {}
  offers.forEach((o) => {
    if (typeof o.price === 'number' && typeof o.qty === 'number' && o.qty > 0) {
      unitPrices[o.id] = o.price / o.qty
    }
  })
  return {
    score: binary(chosen === best),
    reveal: { best_offer_id: best, unit_prices: unitPrices },
  }
}

// ---- budget_fit ------------------------------------------------------------------

const gradeBudgetFit: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const selected = a ? strArray(a.selected_ids) : null
  const budget = num(segment.payload.budget)
  const items = segment.payload.items as
    | Array<{ id: string; price: number; need?: boolean }>
    | undefined
  if (!selected || budget === null || !Array.isArray(items)) return MALFORMED
  const chosen = new Set(selected)
  const total = items.reduce((acc, i) => acc + (chosen.has(i.id) ? i.price : 0), 0)
  const needsIds = items.filter((i) => i.need === true).map((i) => i.id)
  const mustBuyNeeds = segment.payload.must_buy_needs === true
  const missedNeeds = mustBuyNeeds ? needsIds.filter((id) => !chosen.has(id)).length : 0

  const budgetLapse: 'none' | 'mild' | 'gross' =
    total <= budget ? 'none' : total <= budget * 1.1 ? 'mild' : 'gross'
  const needLapse: 'none' | 'mild' | 'gross' =
    missedNeeds === 0 ? 'none' : missedNeeds === 1 ? 'mild' : 'gross'

  let score = 0
  if (budgetLapse === 'none' && needLapse === 'none') score = 100
  // Exactly ONE mild lapse (over by ≤10% XOR one need missed) earns the 50 band.
  else if (budgetLapse !== 'gross' && needLapse !== 'gross' && (budgetLapse === 'mild') !== (needLapse === 'mild'))
    score = 50

  return { score, reveal: { budget, needs_ids: needsIds } }
}

// ---- savings_goal ----------------------------------------------------------------

const gradeSavingsGoal: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const weeks = a ? numRecord(a.weeks) : null
  const goal = num(segment.payload.goal)
  const options = numArray(segment.payload.weekly_options)
  if (!weeks || goal === null || !options || options.length === 0) return MALFORMED
  const correct: Record<string, number> = {}
  let hits = 0
  options.forEach((weekly) => {
    const expected = Math.ceil(goal / weekly)
    correct[String(weekly)] = expected
    if (weeks[String(weekly)] === expected) hits++
  })
  return { score: ratio(hits, options.length), reveal: { correct } }
}

// ---- fair_trade ------------------------------------------------------------------

const VERDICTS = ['fair', 'a_wins', 'b_wins'] as const

const gradeFairTrade: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const chosen = a ? str(a.verdict) : null
  const correct = key ? str(key.verdict) : null
  if (!chosen || !correct || !(VERDICTS as readonly string[]).includes(chosen)) return MALFORMED
  return { score: binary(chosen === correct), reveal: { verdict: correct } }
}

// ---- interest_peek ---------------------------------------------------------------

const gradeInterestPeek: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const prediction = obj(segment.payload.prediction)
  if (!a || !key || !prediction) return MALFORMED
  if (prediction.kind === 'choice') {
    const chosen = str(a.option_id)
    const correct = str(key.correct_option_id)
    if (!chosen || !correct) return MALFORMED
    return { score: binary(chosen === correct), reveal: { correct_option_id: correct } }
  }
  const value = num(a.value)
  const target = num(key.value)
  if (value === null || target === null) return MALFORMED
  const tolerance = num(key.tolerance) ?? Math.abs(target) * 0.05
  return { score: toleranceBands(value, target, tolerance), reveal: { value: target, tolerance } }
}

export const moneyGraders: Record<string, FamilyGrader> = {
  coin_count: gradeCoinCount,
  make_change: gradeMakeChange,
  piggy_split: gradePiggySplit,
  needs_wants: gradeNeedsWants,
  price_compare: gradePriceCompare,
  budget_fit: gradeBudgetFit,
  savings_goal: gradeSavingsGoal,
  fair_trade: gradeFairTrade,
  interest_peek: gradeInterestPeek,
}
