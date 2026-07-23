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
 * A new array ordered deterministically by hash(seed + keyOf(item)). Pass the
 * segment id as `seed` so every segment gets its own stable order.
 */
export function seededSort<T>(items: readonly T[], seed: string, keyOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => hashCode(seed + keyOf(a)) - hashCode(seed + keyOf(b)))
}
