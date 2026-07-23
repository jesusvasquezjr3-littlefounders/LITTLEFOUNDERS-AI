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

/**
 * Rescale authored decision qualities to the 0–100 grading scale. Forge has
 * shipped quality maps on a 0–1 scale (e.g. best_decision `{a:1,b:0.3}`); read
 * verbatim, the correct answer scored 1/100 and could never pass. When the
 * largest authored quality is ≤ 1 (and positive) the whole map is read as 0–1
 * and multiplied by 100; maps that already peak above 1 pass through
 * unchanged. Returns the multiplier so an entire map rescales consistently.
 */
export function qualityScaleFactor(values: number[]): number {
  let max = 0
  for (const v of values) if (v > max) max = v
  return max > 0 && max <= 1 ? 100 : 1
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

// ---- Numeric text equivalence (digits vs. spelled-out number words) ----------

type WordMap = Record<string, number>

const EN_ONES: WordMap = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const EN_TENS: WordMap = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const ES_ONES: WordMap = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const ES_TENS: WordMap = {
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
}
const PT_ONES: WordMap = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
}
const PT_TENS: WordMap = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
}
const HUNDRED_WORDS = new Set(['hundred', 'cien', 'ciento', 'cem'])
const ALL_ONES: WordMap = { ...EN_ONES, ...ES_ONES, ...PT_ONES }
const ALL_TENS: WordMap = { ...EN_TENS, ...ES_TENS, ...PT_TENS }

/**
 * Parses a spelled-out number word/phrase (already accent-stripped + lowercased
 * by normalizeText) in ANY of en-US/es-MX/pt-BR into its numeric value, 0-100.
 * Content is always authored in one locale at a time, so cross-language word
 * collisions aren't a practical concern; deliberately capped at 100 — larger
 * amounts are always typed as digits in practice, both by authors and kids.
 */
function wordsToNumber(normalized: string): number | null {
  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.length === 1) {
    const t = tokens[0] as string
    if (t in ALL_ONES) return ALL_ONES[t] as number
    if (t in ALL_TENS) return ALL_TENS[t] as number
    if (HUNDRED_WORDS.has(t)) return 100
    return null
  }
  if (tokens.length === 2) {
    const [a, b] = tokens as [string, string]
    if (a in ALL_TENS && b in ALL_ONES) {
      const ones = ALL_ONES[b] as number
      if (ones > 0 && ones < 10) return (ALL_TENS[a] as number) + ones
    }
    if (a === 'one' && b === 'hundred') return 100
  }
  if (tokens.length === 3) {
    // Spanish "treinta y cinco" / Portuguese "trinta e cinco".
    const [a, joiner, b] = tokens as [string, string, string]
    if ((joiner === 'y' || joiner === 'e') && a in ALL_TENS && b in ALL_ONES) {
      const ones = ALL_ONES[b] as number
      if (ones > 0 && ones < 10) return (ALL_TENS[a] as number) + ones
    }
  }
  return null
}

/** Digit literal: strips currency/percent symbols, treats a single comma OR period as the decimal mark. */
function parseNumericLiteral(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const stripped = trimmed.replace(/[$€£%\s]/g, '')
  if (!/^-?\d+([.,]\d+)?$/.test(stripped)) return null
  const n = Number(stripped.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Digits or spelled-out words (any of the 3 course locales) → number, or null if neither parses. */
export function parseNumericText(raw: string): number | null {
  const literal = parseNumericLiteral(raw)
  if (literal !== null) return literal
  return wordsToNumber(normalizeText(raw))
}

/** True when both strings denote the same number, however each is written ("5" vs. "cinco" vs. "five"). */
export function numericTextEquals(input: string, expected: string): boolean {
  const a = parseNumericText(input)
  const b = parseNumericText(expected)
  return a !== null && b !== null && a === b
}
