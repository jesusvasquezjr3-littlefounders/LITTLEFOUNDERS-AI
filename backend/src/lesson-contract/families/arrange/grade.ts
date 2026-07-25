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
  // The component only ever calls onFinish once EVERY pair is matched (there is
  // no partial-completion submission path) — so by the time this grader runs,
  // the board is already fully solved. Finishing IS the win: always full credit,
  // never gated behind a pass_threshold the flip count could fail to clear.
  return { score: 100 }
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

/**
 * PARTIAL_CREDIT_TOO_GENEROUS (confirmed 2026-07-25, order_steps / rank_choices /
 * build_sentence) — the ordering metrics are generous by construction, and at the
 * default 70 pass threshold that CERTIFIED a wrong order: one adjacent swap scored
 * kendall 83 over 4 steps (order_steps), footrule 75 over 4 items and 92 over 7
 * (rank_choices), and positional 80 on a 5-slot sentence (build_sentence) — so a
 * child who put the very price the lesson teaches in the wrong slot was told
 * "correct". For an arrange-ordering exercise the order IS the whole objective, so
 * a near-miss has to read as "close, try again", never as mastery.
 *
 * SCORING is the right layer here: the hole is in the formula, not in the content.
 * The best-wrong-answer score depends only on the item count (1 − 1/C(n,2) for
 * kendall, 1 − 2/⌊n²/2⌋ for footrule, (n−1)/n for positional), so no authoring gate
 * could close it without banning every ordering longer than 3 items — i.e. banning
 * the types. The fix caps ANY imperfect ordering at IMPERFECT_ORDER_CEILING while
 * leaving each metric untouched BELOW the cap, so the partial score still tells the
 * child how close they were (33 ≠ 60) and the ceiling sits clear of the 70 default.
 *
 * Nothing that used to score 100 changes: an exact match to `order` — or to any
 * `accept_orders` entry, which is exactly how a genuinely swappable pair is meant to
 * be declared — is still full credit, so no exercise becomes unwinnable.
 * `timeline_order` shares this grader and the same arithmetic hole (a transposition
 * over 7 events scored 71), so it inherits the cap.
 */
const IMPERFECT_ORDER_CEILING = 60

function gradeOrder(
  scorer: (user: string[], correct: string[]) => number,
): FamilyGrader {
  return (segment, answer) => {
    const a = obj(answer)
    const key = obj(segment.answer)
    const user = a ? strArray(a.order) : null
    const correct = key ? strArray(key.order) : null
    if (!user || !correct || correct.length === 0) return MALFORMED
    // A segment may accept a SET of equally-valid orderings — genuinely swappable
    // steps (verify price ↔ take payment) or alternative phrasings ("2 vasos por 10
    // pesos" ↔ "10 pesos por 2 vasos"). Score against `order` and every entry in
    // `accept_orders`, keep the best, and reveal the accepted ordering nearest the
    // child's attempt. Absent accept_orders, this is exactly the single-order path.
    const alts =
      key && Array.isArray(key.accept_orders)
        ? (key.accept_orders as unknown[])
            .map(strArray)
            .filter((o): o is string[] => o !== null && o.length === correct.length)
        : []
    let best = { score: scorer(user, correct), order: correct }
    for (const cand of alts) {
      const s = scorer(user, cand)
      if (s > best.score) best = { score: s, order: cand }
    }
    // Exactness is checked structurally, not by `score === 100`, so the full-credit
    // path can never depend on a metric's rounding: the intended answer (or any
    // accepted alternative) always scores 100, everything else is capped.
    const exact = user.length === best.order.length && user.every((id, i) => id === best.order[i])
    return {
      score: exact ? 100 : Math.min(best.score, IMPERFECT_ORDER_CEILING),
      reveal: { order: best.order },
    }
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
