// `arrange` family — pure validators (LESSON_ENGINE.md §5.4, §6).
// Malformed answers → score 0, never throw. All partial credit uses the shared
// scoring helpers (kendall, footrule, positional, ratio, linearFalloff).

import type { FamilyGrader, GradeOutcome } from '../../core/types.js'
import { footrule, kendall, linearFalloff, positional, ratio } from '../../core/scoring.js'

type Dict = Record<string, unknown>

function obj(v: unknown): Dict | null {
  return typeof v === 'object' && v !== null ? (v as Dict) : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null
}

function strRecord(v: unknown): Record<string, string> | null {
  const o = obj(v)
  if (!o) return null
  return Object.values(o).every((x) => typeof x === 'string') ? (o as Record<string, string>) : null
}

const MALFORMED: GradeOutcome = { score: 0 }

// ---- match_pairs -----------------------------------------------------------------

const gradeMatchPairs: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const keyPairs = key?.pairs
  if (!a || !Array.isArray(a.pairs) || !Array.isArray(keyPairs) || keyPairs.length === 0) {
    return MALFORMED
  }
  const isPair = (p: unknown): p is [string, string] =>
    Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string'
  if (!a.pairs.every(isPair) || !keyPairs.every(isPair)) return MALFORMED
  const correctByLeft = new Map<string, string>(keyPairs)
  // One pair per left id (UI enforces it; grader stays defensive — first wins).
  const userByLeft = new Map<string, string>()
  a.pairs.forEach(([l, r]) => {
    if (!userByLeft.has(l)) userByLeft.set(l, r)
  })
  let hits = 0
  correctByLeft.forEach((r, l) => {
    if (userByLeft.get(l) === r) hits++
  })
  return {
    score: ratio(hits, correctByLeft.size),
    reveal: { pairs: keyPairs },
  }
}

// ---- memory_flip (flow, derived — no answer key) -----------------------------------

const gradeMemoryFlip: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const flips = a ? num(a.flips) : null
  const payloadPairs = segment.payload.pairs
  const pairCount = Array.isArray(payloadPairs) ? payloadPairs.length : num(a?.pairs)
  if (flips === null || flips < 0 || !pairCount || pairCount <= 0) return MALFORMED
  // Perfect recall: every pair found in one revisit budget (2·pairs + 2 flips).
  const budget = 2 * pairCount + 2
  const extraFlips = Math.max(0, flips - budget)
  const extraFlipPairs = Math.ceil(extraFlips / 2)
  // Completion always scores ≥ 40 — finishing the board is itself the win (P3).
  return { score: Math.max(40, 100 - 10 * extraFlipPairs) }
}

// ---- sort_buckets ------------------------------------------------------------------

const gradeSortBuckets: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const assignments = a ? strRecord(a.assignments) : null
  const correct = key ? strRecord(key.assignments) : null
  if (!assignments || !correct || Object.keys(correct).length === 0) return MALFORMED
  const itemIds = Object.keys(correct)
  let hits = 0
  itemIds.forEach((id) => {
    if (assignments[id] === correct[id]) hits++
  })
  return { score: ratio(hits, itemIds.length), reveal: { assignments: correct } }
}

// ---- order_steps / rank_choices / build_sentence / timeline_order -------------------

function gradeOrder(
  scorer: (user: string[], correct: string[]) => number,
): FamilyGrader {
  return (segment, answer) => {
    const a = obj(answer)
    const key = obj(segment.answer)
    const user = a ? strArray(a.order) : null
    const correct = key ? strArray(key.order) : null
    if (!user || !correct || correct.length === 0) return MALFORMED
    return { score: scorer(user, correct), reveal: { order: correct } }
  }
}

const gradeOrderSteps = gradeOrder(kendall)
const gradeRankChoices = gradeOrder(footrule)
const gradeBuildSentence = gradeOrder(positional)
const gradeTimelineOrder = gradeOrder(positional)

// ---- pattern_complete ----------------------------------------------------------------

const gradePatternComplete: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const placed = a ? strRecord(a.placed) : null
  const correct = key ? strRecord(key.correct) : null
  if (!placed || !correct || Object.keys(correct).length === 0) return MALFORMED
  const slots = Object.keys(correct)
  let hits = 0
  slots.forEach((slot) => {
    if (placed[slot] === correct[slot]) hits++
  })
  return { score: ratio(hits, slots.length), reveal: { correct } }
}

// ---- group_sets ------------------------------------------------------------------------

const GROUP_ZONES = new Set(['a', 'b', 'both', 'none'])

const gradeGroupSets: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const zones = a ? strRecord(a.zones) : null
  const correct = key ? strRecord(key.zones) : null
  if (!zones || !correct || Object.keys(correct).length === 0) return MALFORMED
  if (!Object.values(zones).every((z) => GROUP_ZONES.has(z))) return MALFORMED
  const itemIds = Object.keys(correct)
  let hits = 0
  itemIds.forEach((id) => {
    if (zones[id] === correct[id]) hits++
  })
  return { score: ratio(hits, itemIds.length), reveal: { zones: correct } }
}

// ---- number_line -------------------------------------------------------------------------

const gradeNumberLine: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  const value = a ? num(a.value) : null
  const target = key ? num(key.value) : null
  const full = key ? num(key.full_credit_delta) : null
  const zero = key ? num(key.zero_credit_delta) : null
  if (value === null || target === null || full === null || zero === null) return MALFORMED
  return {
    score: linearFalloff(value, target, full, zero),
    reveal: { value: target },
  }
}

export const arrangeGraders: Record<string, FamilyGrader> = {
  match_pairs: gradeMatchPairs,
  memory_flip: gradeMemoryFlip,
  sort_buckets: gradeSortBuckets,
  order_steps: gradeOrderSteps,
  rank_choices: gradeRankChoices,
  build_sentence: gradeBuildSentence,
  timeline_order: gradeTimelineOrder,
  pattern_complete: gradePatternComplete,
  group_sets: gradeGroupSets,
  number_line: gradeNumberLine,
}
