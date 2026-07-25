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

/**
 * Class-balanced accuracy for a two-way, per-item labelling widget: the child
 * makes an explicit A-or-B call on EVERY item (need/want), so both classes are
 * decisions and both must be paid for equally.
 *
 * WHY IT EXISTS (naive_strategy_passes, 2026-07-25): `needs_wants` graded with
 * plain `decisionAccuracy`, which pays for the MAJORITY class. Its answer builder
 * turns "tap Want on every card" into an EMPTY `needs_ids`, so that blanket answer
 * scored (N−P)/N — with 8 items and 2 needs that is 75, clearing the 70 pass
 * threshold with zero needs-vs-wants thinking; "tap Need on everything" scored P/N
 * and passed the mirror-image set. The schema allows 4–12 items with any number of
 * needs, so no content shape prevented it.
 *
 * Averaging the two per-CLASS hit rates removes the majority payout: a blanket
 * answer gets one rate perfect and the other 0, i.e. exactly 50, at ANY
 * needs:wants ratio — it can never pass. Nothing a reasoning child earned is taken
 * away: an all-correct answer is still exactly 100, and on a balanced set (as many
 * needs as wants) the mean of the two rates IS (TP+TN)/N, so those lessons grade
 * bit-for-bit as before.
 *
 * When one class is empty the mean is undefined AND there is nothing to
 * discriminate, so this falls back to plain accuracy — that keeps such an item set
 * WINNABLE (labelling every item "want" on an all-wants set still scores 100)
 * instead of unwinnable; coursegen's gate 8 refuses to author that shape at all.
 *
 * SECOND CALL SITE — `yes_no_cases` (same defect class, same audit): its widget also
 * refuses to submit until the child has pressed Yes or No on EVERY case, so "press NO
 * on all of them" was an executable, thought-free strategy worth (N−P)/N under pooled
 * accuracy — 75 on 8 cases with 2 applying, 83 on 6 with 1, both clear of the 70
 * threshold without a single case being tested against the rule. The same per-class
 * mean pins it at 50 there too, and on a skewed set it is usually MORE generous to a
 * child who reasoned (the 1 applying case of 8 found, plus one slip → 93, where
 * pooled accuracy gave 88). Deliberately NOT `setF1`: that helper ignores true
 * negatives, and here rejecting the cases the rule does NOT cover is half of the
 * skill being taught.
 */
export function balancedDecisionAccuracy(
  selected: string[],
  positives: string[],
  universe: string[],
): number {
  if (universe.length === 0) return 0
  const sel = new Set(selected)
  const pos = new Set(positives)
  let positiveTotal = 0
  let positiveHits = 0
  let negativeTotal = 0
  let negativeHits = 0
  universe.forEach((id) => {
    const isPositive = pos.has(id)
    const agrees = sel.has(id) === isPositive
    if (isPositive) {
      positiveTotal++
      if (agrees) positiveHits++
    } else {
      negativeTotal++
      if (agrees) negativeHits++
    }
  })
  if (positiveTotal === 0 || negativeTotal === 0) {
    return decisionAccuracy(selected, positives, universe)
  }
  return clampScore(((positiveHits / positiveTotal + negativeHits / negativeTotal) / 2) * 100)
}

/**
 * Set F1 — harmonic mean of precision and recall over the items the child
 * ACTUALLY claimed. Use this instead of `decisionAccuracy` whenever the widget is
 * a "find the targets" multi-toggle where NOT tapping is the default state rather
 * than a decision the child makes.
 *
 * WHY IT EXISTS (naive_strategy_passes, 2026-07-25): `spot_error` graded with
 * `decisionAccuracy`, which counts every untouched step as a correct decision. On
 * an N-step list with P flawed steps, tapping ONE arbitrary step scored
 * (N−1−P)/N — 71 at N=7 and 80 at N=10 (the schema allows up to 10 steps) — and
 * the type's canSubmit rule only requires a single selection, so "tap any step"
 * cleared the 70 threshold with zero reasoning. The same formula also handed 80
 * to a child who found only ONE of two flawed steps on a 10-step list, i.e. who
 * missed a flaw the lesson exists to teach.
 *
 * F1 pays only for asserted items: precision = hits/|selected|,
 * recall = hits/|positives|, score = 2·hits/(|selected| + |positives|).
 *   • the exact error set still scores 100 — nothing that was right becomes wrong;
 *   • volume collapses: select-all with 1 target of 10 → 2·1/11 = 18;
 *   • full recall plus one slip still passes (2·2/(3+2) = 80), so genuine
 *     reasoning is not punished for a single mis-tap.
 *
 * Residual degenerate shape: when MOST items are keyed as targets, "tap
 * everything" reaches 2P/(N+P) ≥ 70 (e.g. 2 of 3). That is a content defect, not
 * a formula one — coursegen's gate 8 rejects it at authoring time using this
 * exact arithmetic, as it already does for red_flags/speed_tap.
 */
export function setF1(selected: string[], positives: string[]): number {
  const sel = new Set(selected)
  const pos = new Set(positives)
  if (sel.size === 0 && pos.size === 0) return 100
  if (sel.size === 0 || pos.size === 0) return 0
  let hits = 0
  sel.forEach((id) => {
    if (pos.has(id)) hits++
  })
  return clampScore(((2 * hits) / (sel.size + pos.size)) * 100)
}

/**
 * Signal detection — rewards discrimination, not volume.
 *
 * Youden's J: hit rate minus false-alarm rate, scaled to 0-100. `total` is the
 * number of SELECTABLE items, so negatives = total - positives.
 *
 * WHY THE FORMULA CHANGED (2026-07-24): this used to be
 * `ratio(max(0, hits - falseAlarms), positives.length)`, which subtracts a flat 1
 * per false alarm and therefore cannot punish "select everything" when there are
 * few distractors. Measured on the live red-flags lesson (4 red flags, 1 innocent
 * line): tapping every card scored ratio(4-1, 4) = 75, clearing the 70 pass
 * threshold — so the anti-"flag-everything" design the type exists for was
 * defeated by the scorer. With rates instead of counts, selecting everything
 * always yields hitRate 1 - faRate 1 = 0, at any ratio of positives to negatives.
 *
 * The false-alarm rate is weighted 0.5 deliberately. At weight 1.0 (textbook
 * Youden) a single slip is unrecoverable when there are few negatives — with 4
 * targets and 2 innocents, one false alarm caps the score at 50% hit rate and the
 * child cannot pass however well they discriminated. At 0.5 the two properties we
 * need both hold: "select everything" scores at most 1 - 0.5 = 50 and so can NEVER
 * clear the 70 threshold at ANY positive:negative ratio (the bug), while a child
 * who found every target with one slip still earns 75 (fairness).
 *
 * A degenerate item set with NO negatives makes discrimination impossible
 * (everything is a target, so faRate is always 0); coursegen's gate 7 rejects
 * that at authoring time rather than silently scoring it 100 here.
 */
export function signalDetection(selected: string[], positives: string[], total: number): number {
  if (positives.length === 0) return 0
  const pos = new Set(positives)
  const picked = new Set(selected)
  let hits = 0
  let falseAlarms = 0
  picked.forEach((id) => {
    if (pos.has(id)) hits++
    else falseAlarms++
  })
  const negatives = Math.max(0, total - pos.size)
  const hitRate = hits / pos.size
  const falseAlarmRate = negatives > 0 ? falseAlarms / negatives : 0
  const FALSE_ALARM_WEIGHT = 0.5
  return clampScore((hitRate - FALSE_ALARM_WEIGHT * falseAlarmRate) * 100)
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

/**
 * A split is right only when EVERY jar lands inside its [min,max] target — 100;
 * anything else keeps a proportional signal inside a sub-pass band. Invalid (0)
 * unless the allocation totals the income (±0.5%).
 *
 * WHY THE PARTIAL BAND IS CAPPED (partial_credit_too_generous, 2026-07-25): this
 * returned `ratio(inRange, keys)` outright, and `piggy_split` allows up to 4 jars —
 * so three-of-four in range scored 75 and CLEARED the 70 pass threshold with one
 * jar still wrong, including the case where that jar got a flat 0, which is exactly
 * the "leave a jar empty" misconception the type exists to correct. A split is not
 * partly right: either every jar is inside its range or the plan is wrong. Fixed at
 * the formula because the fourth jar is not a "critical element" the author can
 * mark — every jar is load-bearing, so no content gate could express this.
 *
 * The intended allocation still scores exactly 100 (never unwinnable), and the
 * near-miss band matches the rest of the family's sub-pass idiom (`sumEquals` 40,
 * `toleranceBands` 50), so the results screen still shows how close the child got.
 */
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
  if (inRange === keys.length) return 100
  const NEAR_BAND_CEILING = 50
  return clampScore((inRange / keys.length) * NEAR_BAND_CEILING)
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

/**
 * Keyword coverage %: how many expected keywords appear in the input.
 *
 * A PURELY NUMERIC keyword must match as a WHOLE number, never as a digit
 * substring. DEFECT — partial_credit_too_generous, proven on the shipped
 * type_answer lesson keyed `accept: ["20"], keywords: ["20"]` with
 * `max_chars: 3`: bare containment let "200" and "120" (both typeable, both
 * plausible wrong sums for 12 + 8) fall through the accept path and then score
 * a full 100 on the keyword path — the child got the arithmetic wrong and was
 * told it was perfect. This is the right layer because the containment test IS
 * the formula that rewards it; no authoring shape can be blamed for "20"
 * living inside "200".
 *
 * Word keywords keep substring matching on purpose: authors rely on it for
 * stems ("ahorr" covering "ahorrar"/"ahorro"), and tightening those could fail
 * answers that pass today. "20" inside "200" is never a stem — it is a
 * different quantity — so only numeric keywords change.
 */
export function keywordCoverage(input: string, keywords: string[], caseSensitive = false): number {
  if (keywords.length === 0) return 0
  const haystack = normalizeText(input, caseSensitive)
  // normalizeText turns "1,50" into "1 50", so a numeric keyword can be several digit groups.
  const padded = ` ${haystack} `
  let hits = 0
  keywords.forEach((k) => {
    const needle = normalizeText(k, caseSensitive)
    const numeric = /^\d+(?: \d+)*$/.test(needle)
    if (numeric ? padded.includes(` ${needle} `) : haystack.includes(needle)) hits++
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
