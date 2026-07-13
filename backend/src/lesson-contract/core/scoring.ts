// Pure scoring helpers — LESSON_ENGINE.md §6.
// Dependency-free on purpose: Core will reuse these server-side when the
// content-schema session lands. Keep every function pure and numerically tested.

export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function binary(condition: boolean): number {
  return condition ? 100 : 0
}

export function ratio(hits: number, total: number): number {
  if (total <= 0) return 0
  return clampScore((hits / total) * 100)
}

/** Kendall pairwise concordance between the user's order and the correct order. */
export function kendall(user: string[], correct: string[]): number {
  if (user.length !== correct.length || correct.length < 2) return 0
  if (new Set(user).size !== user.length) return 0
  const pos = new Map(correct.map((id, i) => [id, i]))
  if (!user.every((id) => pos.has(id))) return 0
  let concordant = 0
  let total = 0
  for (let i = 0; i < user.length; i++) {
    for (let j = i + 1; j < user.length; j++) {
      total++
      const pi = pos.get(user[i] as string) as number
      const pj = pos.get(user[j] as string) as number
      if (pi < pj) concordant++
    }
  }
  return ratio(concordant, total)
}

/** Spearman footrule — gentler than Kendall; for judgment rankings. */
export function footrule(user: string[], correct: string[]): number {
  const n = correct.length
  if (user.length !== n || n < 2) return 0
  const pos = new Map(correct.map((id, i) => [id, i]))
  if (!user.every((id) => pos.has(id)) || new Set(user).size !== n) return 0
  let displacement = 0
  user.forEach((id, i) => {
    displacement += Math.abs((pos.get(id) as number) - i)
  })
  const maxDisplacement = Math.floor((n * n) / 2)
  return clampScore((1 - displacement / maxDisplacement) * 100)
}

/** Exact-position hit ratio (timelines, chains, sentences). */
export function positional(user: string[], correct: string[]): number {
  if (correct.length === 0 || user.length !== correct.length) return 0
  let hits = 0
  correct.forEach((id, i) => {
    if (user[i] === id) hits++
  })
  return ratio(hits, correct.length)
}

export function jaccard(user: string[], correct: string[]): number {
  const a = new Set(user)
  const b = new Set(correct)
  if (a.size === 0 && b.size === 0) return 100
  let intersection = 0
  a.forEach((id) => {
    if (b.has(id)) intersection++
  })
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : ratio(intersection, union)
}

/** (TP + TN) / N over a known universe (yes/no per item). */
export function decisionAccuracy(selected: string[], positives: string[], universe: string[]): number {
  if (universe.length === 0) return 0
  const sel = new Set(selected)
  const pos = new Set(positives)
  let good = 0
  universe.forEach((id) => {
    const isSelected = sel.has(id)
    const isPositive = pos.has(id)
    if (isSelected === isPositive) good++
  })
  return ratio(good, universe.length)
}

/** max(0, hits − false alarms) / positives — punishes flag-everything strategies. */
export function signalDetection(selected: string[], positives: string[]): number {
  if (positives.length === 0) return 0
  const pos = new Set(positives)
  let hits = 0
  let falseAlarms = 0
  new Set(selected).forEach((id) => {
    if (pos.has(id)) hits++
    else falseAlarms++
  })
  return ratio(Math.max(0, hits - falseAlarms), positives.length)
}

/** 100 within tolerance, 50 within 2× tolerance, else 0. */
export function toleranceBands(value: number, target: number, tolerance: number): number {
  const delta = Math.abs(value - target)
  const tol = Math.max(0, tolerance)
  if (delta <= tol) return 100
  if (delta <= tol * 2) return 50
  return 0
}

/** Linear falloff from 100 (≤ fullDelta) to 0 (≥ zeroDelta). Log-aware for log scales. */
export function linearFalloff(
  value: number,
  target: number,
  fullDelta: number,
  zeroDelta: number,
  scale: 'linear' | 'log' = 'linear',
): number {
  let delta: number
  const full = fullDelta
  let zero = zeroDelta
  if (scale === 'log') {
    if (value <= 0 || target <= 0) return 0
    delta = Math.abs(Math.log10(value) - Math.log10(target))
  } else {
    delta = Math.abs(value - target)
  }
  if (zero <= full) zero = full + Number.EPSILON
  if (delta <= full) return 100
  if (delta >= zero) return 0
  return clampScore((1 - (delta - full) / (zero - full)) * 100)
}

/** % of allocations inside their [min,max] target; invalid unless the total matches (±0.5%). */
export function allocationRanges(
  allocation: Record<string, number>,
  targets: Record<string, { min: number; max: number }>,
  total: number,
): number {
  const keys = Object.keys(targets)
  if (keys.length === 0) return 0
  const sum = keys.reduce((acc, k) => acc + (allocation[k] ?? 0), 0)
  if (Math.abs(sum - total) > Math.abs(total) * 0.005) return 0
  let inRange = 0
  keys.forEach((k) => {
    const v = allocation[k] ?? 0
    const t = targets[k]
    if (t && v >= t.min && v <= t.max) inRange++
  })
  return ratio(inRange, keys.length)
}

/** Calibration payoff: right → confidence, wrong → 100 − confidence. */
export function calibration(correct: boolean, confidence: number): number {
  const c = Math.max(50, Math.min(100, confidence))
  return clampScore(correct ? c : 100 - c)
}

/** 100 exact, `nearScore` within nearDelta, else 0 — coin trays, balance scales. */
export function sumEquals(sum: number, target: number, nearDelta: number, nearScore = 40): number {
  const delta = Math.abs(sum - target)
  if (delta < 1e-9) return 100
  if (delta <= nearDelta) return clampScore(nearScore)
  return 0
}

/** Mean of chosen path/reply qualities (0–100 each). */
export function meanQuality(qualities: number[]): number {
  if (qualities.length === 0) return 0
  return clampScore(qualities.reduce((a, b) => a + b, 0) / qualities.length)
}

// ---- Text matching -----------------------------------------------------------

export function normalizeText(input: string, caseSensitive = false): string {
  let s = input.normalize('NFD').replace(/[̀-ͯ]/g, '')
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  return caseSensitive ? s : s.toLowerCase()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const curr = [i]
    for (let j = 1; j <= n; j++) {
      const deletion = (prev[j] ?? 0) + 1
      const insertion = (curr[j - 1] ?? 0) + 1
      const substitution = (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      curr[j] = Math.min(deletion, insertion, substitution)
    }
    prev = curr
  }
  return prev[n] ?? 0
}

/** Accent-stripped fuzzy equality with edit budget ⌊len/8⌋ (exact for short strings). */
export function fuzzyEquals(input: string, expected: string, caseSensitive = false): boolean {
  const a = normalizeText(input, caseSensitive)
  const b = normalizeText(expected, caseSensitive)
  if (a === b) return true
  const budget = Math.floor(b.length / 8)
  if (budget === 0) return false
  return levenshtein(a, b) <= budget
}

/** Keyword coverage %: how many expected keywords appear in the input. */
export function keywordCoverage(input: string, keywords: string[], caseSensitive = false): number {
  if (keywords.length === 0) return 0
  const haystack = normalizeText(input, caseSensitive)
  let hits = 0
  keywords.forEach((k) => {
    if (haystack.includes(normalizeText(k, caseSensitive))) hits++
  })
  return ratio(hits, keywords.length)
}
