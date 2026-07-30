// Seeded PRNG for the Game Engine — GAME_ENGINE.md §5 rule 5. Every source of
// randomness a simulator touches comes from here, because rewards are derived by
// REPLAYING the player's input log on the server: a single `Math.random()` anywhere
// in the simulation path makes the replay diverge and rejects an honest child's XP.
//
// Algorithm: mulberry32 — a 32-bit state advanced with `+`, `^`, `>>>` and
// `Math.imul`. Every one of those is exactly specified by ECMAScript on int32
// values (`Math.imul` returns the low 32 bits of the integer product, not a float
// multiply), so the browser's V8 and Node agree on the last bit. No float
// accumulator, no transcendental, no engine-defined rounding anywhere in the state
// update — the only float in the module is the final division that maps the 32-bit
// output into [0, 1), and 2^32 is exact in IEEE-754 double.

import type { Rng } from './types.js'

/** 2^32 — the mulberry32 output range, exact in IEEE-754 double. */
const UINT32_RANGE = 4294967296

/** FNV-1a 32-bit offset basis and prime. */
const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

/**
 * Deterministic 32-bit hash of a string (FNV-1a), so a run id can produce a seed.
 * Integer ops only, therefore stable across engines and across releases: the same
 * run id must replay to the same score forever, including on a re-verification
 * months after the attempt was scored.
 */
export function seedFromString(s: string): number {
  let h = FNV_OFFSET_BASIS
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0
}

/**
 * A seeded, deterministic PRNG. The same seed always yields the same sequence;
 * two Rng instances built from the same seed are independent and identical.
 */
export function createRng(seed: number): Rng {
  // ToUint32 — truncates fractions, wraps negatives, maps NaN to 0, so any number
  // is an acceptable seed and no caller can accidentally create a non-integer state.
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE
  }

  return {
    next,
    int(maxExclusive: number): number {
      // Negative, zero, NaN — there is no integer in [0, n), so the only honest
      // answer is 0. Throwing here would turn a content bug into a mid-replay
      // crash on the reward path.
      if (!(maxExclusive > 0)) return 0
      const n = Math.floor(maxExclusive)
      if (n < 1) return 0
      // next() < 1, so floor(next() * n) < n mathematically; the Math.min is the
      // belt-and-braces guard against a float rounding to exactly n for a huge n.
      return Math.min(n - 1, Math.floor(next() * n))
    },
  }
}

/**
 * Fisher-Yates shuffle driven ONLY by `rng.int`, so generated content shuffles
 * reproducibly for a fixed seed. Returns a new array; the input is never mutated.
 */
export function shuffleWith<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1)
    if (j === i) continue
    // Both indices are in [0, out.length) by construction, so the casts discharge
    // `noUncheckedIndexedAccess` without hiding a real hole — and unlike a
    // `?? fallback` they stay correct when T itself includes undefined.
    const swapped = out[i] as T
    out[i] = out[j] as T
    out[j] = swapped
  }
  return out
}
