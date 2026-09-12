// Type-only, so the cycle with LearnPage is erased at compile time.
import type { Course } from '@/routes/app/LearnPage';

/*
 * The shelf a learner already saw, kept for the next time they open /learn.
 *
 * WHY THIS EXISTS. `@tanstack/react-query` has been a dependency since the
 * project started and is imported exactly nowhere, so /learn had no client
 * cache at all: every visit refetched the course list from scratch, behind a
 * spinner, including the /learn → lesson → back → /learn loop that IS the
 * product. Adding react-query for two reads would have put ~13 KB gzip back
 * into an entry chunk this branch just spent a commit halving; this is the
 * forty lines that surface actually needs.
 *
 * STALE-WHILE-REVALIDATE, and never stale-only: a cached shelf paints
 * immediately and a fresh read always goes out behind it, so what a learner
 * sees is at worst one request old and corrects itself without a spinner.
 *
 * EXCEPT RIGHT AFTER A LESSON, which is the one moment a stale number would
 * be read as a bug rather than a beat: finishing a lesson changes the very
 * progress this caches, and a kid returning to the shelf looks straight at it.
 * LessonRoute drops the entry on a successful completion, so that path takes
 * the honest spinner and every other path is instant.
 *
 * KEYED BY USER ID, and module-scoped so it dies with the tab. Progress is
 * personal; a cache that outlived a sign-out would show one child another's
 * shelf. `clearCoursesCache()` is called on sign-out for the same reason —
 * the key check is the belt, that is the braces.
 */

interface Entry {
  userId: string;
  courses: Course[];
}

let entry: Entry | null = null;

/** The cached shelf for this user, or null — never another user's. */
export function readCoursesCache(userId: string | null | undefined): Course[] | null {
  if (!userId || !entry || entry.userId !== userId) return null;
  return entry.courses;
}

export function writeCoursesCache(userId: string | null | undefined, courses: Course[]): void {
  if (!userId) return;
  entry = { userId, courses };
}

/**
 * Drop it. Called when a lesson completes (the progress this holds just
 * changed) and on sign-out (it belongs to the account that is leaving).
 */
export function clearCoursesCache(): void {
  entry = null;
}
