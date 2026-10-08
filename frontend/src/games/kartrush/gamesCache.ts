/*
 * Whether the Learn home offers the game card, as the learner last saw it.
 *
 * The same stale-while-revalidate the shelf uses (routes/app/learn/coursesCache.ts): the card a
 * learner already saw paints at once and a fresh read goes out behind it, so
 * coming back to /learn never flickers an optional card in. Module-scoped and
 * keyed by user id, so it dies with the tab and never shows one learner
 * another's answer (a guardian's setting is personal).
 *
 * `null` is "not known yet": the card stays out until Core answers. A failed
 * read removes the entry, so an optional card that cannot be confirmed is hidden,
 * never left up on a stale yes.
 */

interface Entry { userId: string; enabled: boolean }

let entry: Entry | null = null;

export function readGamesCache(userId: string | null | undefined): boolean | null {
  return userId && entry && entry.userId === userId ? entry.enabled : null;
}

export function writeGamesCache(userId: string | null | undefined, enabled: boolean): void {
  if (userId) entry = { userId, enabled };
}

export function clearGamesCache(): void {
  entry = null;
}
