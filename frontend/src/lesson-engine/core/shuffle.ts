// Deterministic per-segment shuffle (A7). Options, match columns and token
// banks were rendered in the authored order, which is parallel to the answer
// key — so "match straight across" or "pick the first option" won without the
// exercise ever being reasoned through. This shuffle is:
//   • stable across renders for a given segment (so items don't jump under the
//     kid's fingers on re-render or retry), and
//   • decoupled from the authored order (so the display no longer leaks the key).
// Grading is always id/order-based and never depends on display position, so
// reordering the display is purely cosmetic and safe.

import { kendall } from './scoring'

/** Stable string hash (matches the per-family helpers this consolidates). */
export function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/**
 * Murmur3 finalizer — avalanches every input bit across the whole word.
 *
 * WHY THIS EXISTS (real bug, found 2026-07-24 by a grader-level audit): sorting
 * directly on `hashCode(seed + key)` did NOT shuffle at all for the ids this
 * platform actually uses. hashCode is a left-to-right polynomial hash, so for
 * keys that share a prefix and differ only in their final character —
 * "a"/"b"/"c"/"d", "opt1".."opt4", "t1".."t5", "e1".."e5", every option/token id
 * convention in the content — it reduces to `31 * hash(prefix) + charCode`,
 * which is MONOTONIC in that character. Ordering by it reproduced the authored
 * order exactly: measured 500/500 segment seeds returned the identity
 * permutation for both a/b/c/d and opt1..opt4. The anti-leak guarantee in the
 * header comment was therefore vacuous platform-wide, and content that keyed the
 * correct answer as option "a" (or listed a token bank in solution order) was
 * passable by tapping top-to-bottom with no reasoning at all.
 */
function mix32(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h | 0
}

/**
 * A new array ordered deterministically by mix32(hash(seed + keyOf(item))). Pass
 * the segment id as `seed` so every segment gets its own stable order. Ties (an
 * astronomically unlikely 32-bit collision) fall back to the key so the result
 * stays a total order and therefore stable across renders.
 */
export function seededSort<T>(items: readonly T[], seed: string, keyOf: (item: T) => string): T[] {
  const rank = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    if (!rank.has(key)) rank.set(key, mix32(hashCode(`${seed}:${key}`)))
  }
  return [...items].sort((a, b) => {
    const ka = keyOf(a)
    const kb = keyOf(b)
    const d = (rank.get(ka) ?? 0) - (rank.get(kb) ?? 0)
    return d !== 0 ? d : ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

/** The pass mark every graded segment is measured against (LESSON_ENGINE.md §6 default). */
export const PASS_MARK = 70
/** Seeds tried before falling back to the rotation; each try succeeds ~2/3 of the time. */
const MIDDLING_ATTEMPTS = 12

/**
 * `seededSort` with a PROVEN bound on how much the display can leak an ORDERING
 * key: the returned order scores strictly inside (100 − PASS_MARK, PASS_MARK) by
 * `kendall` against the authored order, so BOTH mechanical readings of the bank —
 * top-to-bottom and bottom-to-top — score below the pass mark against it.
 *
 * WHY (real, measured): a plain `seededSort` is a fair shuffle, and a fair shuffle
 * lands on the authored order once every n! segments. Ordering content is authored
 * with `payload.blocks` IN SOLUTION ORDER (the published fixture's `s1-code-order`
 * does exactly that in all three locales), and that segment's seed happens to
 * return the identity permutation — so tapping the bank straight down scored
 * kendall 100 with no reasoning at all. Shuffling harder does not fix a lottery;
 * constraining the outcome does. Note the band must be TWO-SIDED: forcing the
 * display far from the authored order would just move the free pass to
 * "tap bottom-to-top" (kendall of the reverse is 100 − kendall).
 *
 * Deterministic and stable per segment, like `seededSort`. The fallback (rotate by
 * ⌊n/2⌋) is itself always in-band for n = 3..8 — measured 33–43 — so the function
 * cannot return a leaking order for any bank the schemas allow. Fewer than 3 items
 * has no in-band order to find (kendall is 0 or 100), so it degrades to plain
 * `seededSort`; ordering types all require ≥ 3.
 *
 * coursegen's gate 8 (`makerOrderDisplayLeak`) mirrors this function against the
 * real answer key. If you change the arithmetic here, change it there too.
 */
export function seededSortMiddling<T>(
  items: readonly T[],
  seed: string,
  keyOf: (item: T) => string,
): T[] {
  const authored = items.map(keyOf)
  if (authored.length < 3) return seededSort(items, seed, keyOf)
  for (let attempt = 0; attempt < MIDDLING_ATTEMPTS; attempt++) {
    const candidate = seededSort(items, attempt === 0 ? seed : `${seed}#${attempt}`, keyOf)
    const concordance = kendall(candidate.map(keyOf), authored)
    if (concordance > 100 - PASS_MARK && concordance < PASS_MARK) return candidate
  }
  const half = Math.floor(authored.length / 2)
  return [...items.slice(half), ...items.slice(0, half)]
}
