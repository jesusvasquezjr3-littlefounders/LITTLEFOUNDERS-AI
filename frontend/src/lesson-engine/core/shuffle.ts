// Deterministic per-segment shuffle (A7). Options, match columns and token
// banks were rendered in the authored order, which is parallel to the answer
// key — so "match straight across" or "pick the first option" won without the
// exercise ever being reasoned through. This shuffle is:
//   • stable across renders for a given segment (so items don't jump under the
//     kid's fingers on re-render or retry), and
//   • decoupled from the authored order (so the display no longer leaks the key).
// Grading is always id/order-based and never depends on display position, so
// reordering the display is purely cosmetic and safe.

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
