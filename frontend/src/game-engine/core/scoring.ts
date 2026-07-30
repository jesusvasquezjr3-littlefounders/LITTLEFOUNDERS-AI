// Pure scoring helpers — GAME_ENGINE.md §6. Every mechanic composes its score out
// of these; nothing here knows a mechanic exists.
//
// DEPENDENCY-FREE BY CONTRACT. The SERVER re-derives every score by replaying the
// player's input log (the client's number is a claim, never the grant), so this
// module is copied verbatim into `backend/src/game-contract/` and
// `gamegen/src/contract/`. It therefore has ZERO imports — no React, no Zod, no I/O
// — and uses only the §5 allowed arithmetic (`+ - * /`, `Math.min/max/abs/floor/
// ceil/round/trunc/sign/sqrt`). The transcendentals are implementation-defined in
// ECMAScript; one differing bit between browser V8 and Node is a rejected reward for
// an honest child.
//
// INVARIANT for every function below: a finite input yields a finite number. NaN,
// Infinity and division by zero are handled explicitly at each entry point rather
// than allowed to propagate into the reward path.

/**
 * The results-screen verdict band. Deliberately the SAME four labels and the SAME
 * thresholds as the Lesson Engine's `tierFor` in
 * `frontend/src/lesson-engine/core/types.ts` (`>=100 perfect`, `>= pass great`,
 * `>= 40 almost`, else `tryAgain`), so a child meets one feedback language across
 * lessons and games instead of two competing vocabularies.
 */
export type GameScoreTier = 'perfect' | 'great' | 'almost' | 'tryAgain'

/** The sub-pass floor mirrored from the Lesson Engine's `tierFor`. */
const ALMOST_FLOOR = 40

/**
 * The canonical 0..100 integer score. Everything public here funnels through it, so
 * a mechanic can never emit a fractional, out-of-range or non-numeric score.
 *
 * A non-finite input returns 0, NOT 100. The Lesson Engine's twin only guards NaN
 * because its graders cannot produce an infinity; a game simulator accumulating
 * points over thousands of ticks can, and paying a full 100 for an overflowed
 * accumulator would be a reward exploit. Refusing loudly (0) makes the winnability
 * gate fail on the broken mechanic instead of the economy leaking.
 */
export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Clamps into 0..100 WITHOUT rounding — for intermediate values only. */
function clampUnrounded(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Combo curve parameters. Both come from the mechanic's validated `config`. */
export interface ComboConfig {
  /** Consecutive successes needed per extra multiplier step. Must be >= 1. */
  step: number
  /** Inclusive ceiling on the multiplier. Must be >= 1. */
  max: number
}

/**
 * `min(max, 1 + floor(combo / step))` — the v1 curve, with the two constants it
 * hardcoded (`min(5, 1 + floor(c / 5))`) lifted into the document so each mechanic
 * can pace its own reward ramp instead of inheriting one game's tuning.
 *
 * Always returns an integer >= 1: a combo never *reduces* a payout, and a malformed
 * config (step < 1, non-finite anything) degrades to a flat 1x rather than dividing
 * by zero and poisoning the score with Infinity.
 */
export function comboMultiplier(combo: number, config: ComboConfig): number {
  const { step, max } = config
  if (!Number.isFinite(combo) || !Number.isFinite(step) || !Number.isFinite(max)) return 1
  const stride = Math.floor(step)
  if (stride < 1) return 1
  const cap = Math.max(1, Math.floor(max))
  const streak = Math.max(0, Math.floor(combo))
  return Math.min(cap, 1 + Math.floor(streak / stride))
}

/**
 * Plain hit rate, 0..100.
 *
 * `total <= 0` returns 0: no attempts is no EVIDENCE of skill, and the alternative
 * (a free 100 for a run where nothing was ever presented) is exactly the shape a
 * forged short input log would exploit. This matches the Lesson Engine's `ratio`.
 * `correct` is clamped into [0, total] so a double-counted hit cannot exceed 100.
 */
export function accuracyScore(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return 0
  const hits = Math.max(0, Math.min(total, correct))
  return clampScore((hits / total) * 100)
}

/**
 * Progress toward a mechanic's win target, 0..100 (reaching or exceeding the target
 * is 100).
 *
 * A non-positive target returns 0 rather than "trivially met": the score feeds the
 * reward path, so an unset/zeroed target must fail the §9 winnability gate (the
 * perfect bot cannot reach `pass_score`) instead of granting full XP for free.
 */
export function targetScore(achieved: number, target: number): number {
  if (!Number.isFinite(achieved) || !Number.isFinite(target) || target <= 0) return 0
  return clampScore((Math.max(0, achieved) / target) * 100)
}

/**
 * How far through the intended run length the player lasted, 0..100. Ticks are
 * whole `TICK_MS` steps, so both inputs are floored before the division — a
 * fractional tick count is not a state the simulation can be in.
 */
export function survivalScore(ticksSurvived: number, targetTicks: number): number {
  if (!Number.isFinite(ticksSurvived) || !Number.isFinite(targetTicks)) return 0
  return targetScore(Math.floor(Math.max(0, ticksSurvived)), Math.floor(targetTicks))
}

/**
 * The economy signal (stacker budget, defender gold, launcher projectiles): spending
 * NOTHING is 100, spending the whole budget or more is 0, linear in between.
 *
 * A non-positive budget returns 0 for the same reason as `targetScore`: there is no
 * economy to be efficient in, and paying 100 for that would reward a broken manifest.
 */
export function efficiencyScore(used: number, budget: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(budget) || budget <= 0) return 0
  const spent = Math.max(0, Math.min(budget, used))
  return clampScore((1 - spent / budget) * 100)
}

/** One blended signal: a 0..100 sub-score and its relative weight. */
export interface ScorePart {
  value: number
  weight: number
}

/**
 * Weighted mean of several 0..100 signals (e.g. launcher accuracy vs. projectiles
 * left, stacker height vs. efficiency). Each `value` is clamped into 0..100 BEFORE
 * weighting, so one runaway component cannot drag the blend out of range.
 *
 * Parts with a non-positive or non-finite weight are ignored — a weight is a share,
 * and a negative share would let one signal subtract another's earned points. When
 * every weight is ignored the total is 0 and the function returns 0 explicitly
 * rather than dividing by it.
 */
export function weightedScore(parts: readonly ScorePart[]): number {
  let totalWeight = 0
  let accumulated = 0
  for (const part of parts) {
    const weight = part.weight
    if (!Number.isFinite(weight) || weight <= 0) continue
    totalWeight += weight
    accumulated += clampUnrounded(part.value) * weight
  }
  if (totalWeight <= 0) return 0
  return clampScore(accumulated / totalWeight)
}

/**
 * Deducts `perPenaltyPct` POINTS of the 0..100 scale per penalty (wrong drop, leaked
 * enemy, collapsed tower) — a flat, kid-legible subtraction, never a compounding
 * multiplier: "each mistake costs 5" is something a 7-year-old can hold in their
 * head, "each mistake removes 5% of what's left" is not.
 *
 * Fractional penalty counts are floored (a penalty either happened or it did not)
 * and negative counts/rates are treated as zero, so this can only ever lower a score.
 */
export function applyPenalty(score: number, penalties: number, perPenaltyPct: number): number {
  const base = clampScore(score)
  if (!Number.isFinite(penalties) || !Number.isFinite(perPenaltyPct)) return base
  const count = Math.max(0, Math.floor(penalties))
  const rate = Math.max(0, perPenaltyPct)
  return clampScore(base - count * rate)
}

/**
 * The results-screen band. Mirrors `tierFor` in the Lesson Engine
 * (`frontend/src/lesson-engine/core/types.ts`) exactly, including the order of the
 * comparisons: a `passScore` below 40 makes "great" win over "almost" there too.
 */
export function tierForScore(score: number, passScore: number): GameScoreTier {
  const value = clampScore(score)
  const pass = clampScore(passScore)
  if (value >= 100) return 'perfect'
  if (value >= pass) return 'great'
  if (value >= ALMOST_FLOOR) return 'almost'
  return 'tryAgain'
}
