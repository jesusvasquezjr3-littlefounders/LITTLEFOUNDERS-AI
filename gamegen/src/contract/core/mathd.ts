// Deterministic math for the Game Engine — GAME_ENGINE.md §5 / brief §4.
//
// WHY THIS MODULE EXISTS
// ----------------------
// A play session's reward is not the number the client reports: Core re-runs the
// mechanic's simulator over the player's input log and derives the score itself. That
// is only sound if a simulator produces BIT-IDENTICAL results in the browser's V8 and
// in Node.
//
// ECMAScript leaves `Math.sin`, `cos`, `tan`, `atan`, `atan2`, `exp`, `log`, `pow`,
// `hypot` and `cbrt` IMPLEMENTATION-DEFINED — the spec only requires an implementation-
// approximated result, so two engines (or two builds of the same engine) may disagree
// in the low bits. One wrong bit in a projectile arc is a rejected reward for an honest
// child. What IS exactly specified is IEEE-754 `+ - * /` and `Math.sqrt`, plus the
// exactly-defined `Math.abs/min/max/floor/ceil/round/trunc/sign`. So every function
// here is built from ONLY those operations, evaluating fixed-term Taylor series with
// exact range reduction.
//
// Corollary that is easy to get wrong: a lookup table populated by calling `Math.sin`
// would bake the very engine dependency we are removing into the table. There is no
// table here, and this module must never call a banned function — not even to build a
// constant. `Math.PI` is fine: it is a *constant* the spec pins to the Number value
// closest to pi, identical in every engine.
//
// The functions below define their own results. They are not `Math.*` clones and are
// not expected to agree with `Math.*` to the last bit — only to within ACCURACY.
// Determinism is the contract; agreement with the true function is the quality bar.

/** Fixed tick length is 50ms (§4.2); angles are carried in DEGREES because degree
 *  range reduction stays exact on integers, which keeps the quadrant identities exact. */
const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Maximum absolute error of each approximation versus the true mathematical function.
 * These are the tolerances callers may rely on; they are NOT a claim about matching any
 * particular engine's `Math.*` bit for bit — that is precisely what is unavailable.
 *
 * The bounds are range-independent: degree reduction is exact (only `/`, `*`, `-` and
 * `Math.floor`), and the series never sees an argument above pi/4, so the error at
 * 100000 degrees is the same as at 30 degrees. `mathd.test.ts` asserts them over a dense
 * sweep; the observed maxima there stayed below 2.7e-15 (sin), 2.4e-15 (cos) and 5.7e-14
 * degrees (atan2) — i.e. a few ulps — so each constant below carries roughly an order of
 * magnitude of headroom. A direct comparison against `Math.sin`/`Math.cos` at very large
 * degree values drifts further apart than this, but that drift is `Math.*`'s own argument
 * rounding (`100000 * Math.PI / 180` is ~1745 rad, ulp 2.3e-13), not this module's.
 */
export const ACCURACY = {
  /** |dsin(d) - sin(d deg)| for every finite d. Unitless. */
  sin: 1e-14,
  /** |dcos(d) - cos(d deg)| for every finite d. Unitless. */
  cos: 1e-14,
  /** |datan2(y, x) - atan2(y, x)| for every finite (x, y), in DEGREES. */
  atan2Degrees: 1e-12,
} as const

// ---- Series coefficients ------------------------------------------------------------
//
// Every denominator below is an exact integer factorial (18! = 6402373705728000 is the
// largest, still < 2^53), so each `1 / n` literal is a correctly-rounded double in every
// engine. Coefficients are listed HIGHEST DEGREE FIRST so Horner folds as
// `p = c + u2 * p`.

/** sin(x) = x * (1 - x²/3! + x⁴/5! - … + x¹⁶/17!), in x² . */
const SIN_COEFFICIENTS: readonly number[] = [
  1 / 355687428096000, // 17!
  -1 / 1307674368000, // 15!
  1 / 6227020800, // 13!
  -1 / 39916800, // 11!
  1 / 362880, // 9!
  -1 / 5040, // 7!
  1 / 120, // 5!
  -1 / 6, // 3!
  1,
]

/** cos(x) = 1 - x²/2! + x⁴/4! - … - x¹⁸/18!, in x². */
const COS_COEFFICIENTS: readonly number[] = [
  -1 / 6402373705728000, // 18!
  1 / 20922789888000, // 16!
  -1 / 87178291200, // 14!
  1 / 479001600, // 12!
  -1 / 3628800, // 10!
  1 / 40320, // 8!
  -1 / 720, // 6!
  1 / 24, // 4!
  -1 / 2, // 2!
  1,
]

/** atan(u) = u * (1 - u²/3 + u⁴/5 - …). 24 terms is enough because the argument is
 *  reduced to |u| <= tan(22.5°) ≈ 0.4142 before the series is evaluated. */
const ATAN_TERM_COUNT = 24

const ATAN_COEFFICIENTS: readonly number[] = ((): readonly number[] => {
  const out: number[] = []
  for (let n = ATAN_TERM_COUNT - 1; n >= 0; n -= 1) {
    const denominator = 2 * n + 1
    const even = n - 2 * Math.floor(n / 2) === 0
    out.push(even ? 1 / denominator : -1 / denominator)
  }
  return out
})()

/** tan(22.5°) = sqrt(2) - 1. `Math.sqrt` is exactly specified, so this constant is
 *  identical in every engine. */
const TAN_22_5 = Math.sqrt(2) - 1

// ---- Range reduction ----------------------------------------------------------------

/** Fold any finite degree value into [0, 360) using only `/`, `*`, `-` and `Math.floor`.
 *  The clamps absorb the one-ulp cases where the rounded quotient lands a step high or
 *  low; both clamped angles are within an ulp of a full turn, so 0 is the right answer. */
function reduceTurn(degrees: number): number {
  const turns = Math.floor(degrees / 360)
  const reduced = degrees - 360 * turns
  if (reduced < 0) return 0
  if (reduced >= 360) return 0
  return reduced
}

/** sin series, argument in RADIANS and never larger than pi/4 (see the 45° fold below).
 *  Holding the argument under pi/4 is what keeps the truncation error near 1e-19: the
 *  same series evaluated up at pi/2 truncates at ~4.4e-14, which is measurable. */
function sinSeries(x: number): number {
  const x2 = x * x
  let p = 0
  for (const c of SIN_COEFFICIENTS) p = c + x2 * p
  return x * p
}

/** cos series, argument in RADIANS and never larger than pi/4. */
function cosSeries(x: number): number {
  const x2 = x * x
  let p = 0
  for (const c of COS_COEFFICIENTS) p = c + x2 * p
  return p
}

/** sin of an angle already folded into [0, 90] degrees.
 *  The two exact endpoints are pinned so the quadrant identities (dsin(90) === 1,
 *  dcos(180) === -1, …) hold EXACTLY rather than to within a few ulps of the series.
 *  At and above 45° the complement `sin(a) = cos(90 - a)` takes over; `90 - a` is EXACT
 *  for a in [45, 90] by Sterbenz's lemma, so the fold costs no accuracy.
 *
 *  The threshold is `>= 45` here and `> 45` in `cosQuadrant` ON PURPOSE: it sends both
 *  functions through `cosSeries` at exactly 45°, which is what makes the complement
 *  identity `dsin(90 - d) === dcos(d)` hold exactly at the crossover instead of one ulp
 *  apart. */
function sinQuadrant(degrees: number): number {
  if (degrees === 0) return 0
  if (degrees === 90) return 1
  if (degrees >= 45) return cosSeries((90 - degrees) * DEG_TO_RAD)
  return sinSeries(degrees * DEG_TO_RAD)
}

/** cos of an angle already folded into [0, 90] degrees. Endpoints pinned and the same
 *  45° complement fold, mirrored — see the threshold note in `sinQuadrant`. */
function cosQuadrant(degrees: number): number {
  if (degrees === 0) return 1
  if (degrees === 90) return 0
  if (degrees > 45) return sinSeries((90 - degrees) * DEG_TO_RAD)
  return cosSeries(degrees * DEG_TO_RAD)
}

// ---- Public API ---------------------------------------------------------------------

/**
 * Deterministic sine of an angle in DEGREES.
 * Non-finite input yields NaN, matching what `Math.sin` would do; simulators must never
 * feed a non-finite angle in the first place.
 */
export function dsin(degrees: number): number {
  if (!Number.isFinite(degrees)) return Number.NaN
  let a = reduceTurn(degrees)
  let sign = 1
  if (a > 180) {
    sign = -1
    a = a - 180
  }
  if (a > 90) a = 180 - a
  return sign * sinQuadrant(a)
}

/**
 * Deterministic cosine of an angle in DEGREES.
 * Non-finite input yields NaN (see `dsin`).
 */
export function dcos(degrees: number): number {
  if (!Number.isFinite(degrees)) return Number.NaN
  let a = reduceTurn(degrees)
  // cos is even about 180°, then negative-mirrored about 90°.
  if (a > 180) a = 360 - a
  let sign = 1
  if (a > 90) {
    sign = -1
    a = 180 - a
  }
  return sign * cosQuadrant(a)
}

/** atan of a ratio in [0, 1], returned in DEGREES. Above tan(22.5°) the identity
 *  atan(t) = 45° + atan((t-1)/(t+1)) pulls the argument back into [-0.4142, 0], which is
 *  what keeps 24 series terms sufficient. */
function atanUnitDegrees(ratio: number): number {
  if (ratio > TAN_22_5) {
    const u = (ratio - 1) / (ratio + 1)
    return 45 + atanSeriesDegrees(u)
  }
  return atanSeriesDegrees(ratio)
}

function atanSeriesDegrees(u: number): number {
  if (u === 0) return 0
  const u2 = u * u
  let p = 0
  for (const c of ATAN_COEFFICIENTS) p = c + u2 * p
  return u * p * RAD_TO_DEG
}

/**
 * Deterministic two-argument arctangent, returned in DEGREES in (-180, 180].
 *
 * Quadrant handling is exact (sign tests and subtractions only); only the reduced ratio
 * goes through the series. `datan2(0, 0)` returns 0 rather than NaN — a simulator asking
 * for the heading of a zero-length vector gets a usable, deterministic answer instead of
 * a NaN that would poison every later tick. Non-finite inputs return 0 for the same
 * reason.
 */
export function datan2(y: number, x: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0
  if (x === 0 && y === 0) return 0
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  // Always feed the series a ratio in [0, 1]; the complement keeps steep angles accurate.
  const acute = ax >= ay ? atanUnitDegrees(ay / ax) : 90 - atanUnitDegrees(ax / ay)
  if (x < 0) return y < 0 ? acute - 180 : 180 - acute
  return y < 0 ? -acute : acute
}

/**
 * Deterministic integer power by exponentiation-by-squaring — multiplications and one
 * final division only, so the result is fully specified by IEEE-754.
 *
 * Rejects a non-integer exponent (including NaN and +-Infinity): a fractional power is
 * exactly the implementation-defined case this module exists to avoid, and silently
 * rounding the exponent would make a simulator disagree with its own replay.
 *
 * `dpow(x, 0) === 1` for every x, including 0. A negative exponent of 0 yields Infinity.
 *
 * @throws {RangeError} when `intExponent` is not an integer.
 */
export function dpow(base: number, intExponent: number): number {
  if (!Number.isInteger(intExponent)) {
    throw new RangeError('dpow: exponent must be an integer')
  }
  let remaining = intExponent < 0 ? -intExponent : intExponent
  let result = 1
  let square = base
  while (remaining > 0) {
    const half = Math.floor(remaining / 2)
    if (remaining - half * 2 === 1) result = result * square
    square = square * square
    remaining = half
  }
  return intExponent < 0 ? 1 / result : result
}

/**
 * Deterministic 2D vector length. `Math.hypot` is implementation-defined and therefore
 * banned; `Math.sqrt` is exactly specified by IEEE-754, so this naive form is the
 * deterministic one. It trades `Math.hypot`'s overflow/underflow protection for
 * reproducibility — simulator coordinates are bounded, so the trade is safe here.
 */
export function dhypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}
