import { afterEach, describe, expect, it } from 'vitest';
import { clearCoursesCache, readCoursesCache, writeCoursesCache } from '../coursesCache';
import type { Course } from '@/routes/app/LearnPage';

/*
 * /learn had no client cache at all — `@tanstack/react-query` is a dependency
 * with zero imports — so every visit refetched the shelf behind a spinner,
 * including the lesson -> back -> lesson loop that is the product. This is the
 * cache that replaced it, and the tests below are the two properties that make
 * it safe rather than merely fast.
 */

const course = (slug: string, passed: number): Course =>
  ({
    id: `id-${slug}`,
    slug,
    title: { 'en-US': slug },
    subject: 'money',
    badgeAsset: null,
    inProgress: false,
    adventureCount: 1,
    lessonCount: 10,
    progress: { passed, total: 10, pct: passed * 10 },
  }) as unknown as Course;

afterEach(() => clearCoursesCache());

describe('the /learn courses cache', () => {
  it('gives a user back what was stored for them', () => {
    writeCoursesCache('kid-1', [course('financial-education', 3)]);
    expect(readCoursesCache('kid-1')?.[0]?.progress.passed).toBe(3);
  });

  /*
   * THE PROPERTY THAT MATTERS MOST. Progress is personal, and this is a
   * product for children: a cache that answered for the wrong account would
   * show one child another child's shelf. Keyed reads are the belt; the
   * sign-out clear in AuthContext is the braces.
   */
  it('never answers for a different user', () => {
    writeCoursesCache('kid-1', [course('financial-education', 3)]);

    expect(readCoursesCache('kid-2')).toBeNull();
    expect(readCoursesCache(null)).toBeNull();
    expect(readCoursesCache(undefined)).toBeNull();
  });

  it('refuses to store anything without a user to key it to', () => {
    writeCoursesCache(null, [course('financial-education', 3)]);
    expect(readCoursesCache(null)).toBeNull();
  });

  /*
   * Finishing a lesson changes the very progress this holds, and the shelf is
   * the first thing a kid looks at afterwards — the one moment a stale number
   * reads as a bug rather than as a beat. LessonRoute calls clear() there.
   */
  it('is dropped on demand, so a finished lesson never shows a stale count', () => {
    writeCoursesCache('kid-1', [course('financial-education', 3)]);
    clearCoursesCache();
    expect(readCoursesCache('kid-1')).toBeNull();
  });
});
