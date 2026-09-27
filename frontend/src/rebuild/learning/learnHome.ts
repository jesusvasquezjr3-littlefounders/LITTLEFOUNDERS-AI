import { z } from 'zod';

/*
 * W2L.1 (L1): the learner home's data, the client side of GET /learn/courses.
 *
 * Core decides everything on the shelf: which courses are published and open
 * to this learner, the progress of each (real passes and placement credit),
 * the B.6 pathway frontier when the pathway engine is on (the learner's stage,
 * how the course serves it and the recommended lesson) and, for B.3, the
 * featured course that could not be assembled. The client validates the shape
 * and renders it; it never re-derives a lock or an age. A malformed shelf is
 * unavailable, never partly shown. Transport is injected, so this module
 * imports nothing from the legacy app (Bible 02 rule 23).
 */

const stage = z.enum(['child', 'tween', 'teen', 'adult']);
const localized = z.record(z.string(), z.unknown());
const progress = z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), pct: z.number().min(0).max(100) });

export const shelfCourseSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: localized,
  lessonCount: z.number().int().nonnegative(),
  badgeAsset: z.string().nullable().optional(),
  inProgress: z.boolean().optional(),
  progress,
  /** B.6 pathway mode only. `unavailable` is the age safeguard: listed so nothing vanishes, never offered (OD-16). */
  pathway: z.object({
    learnerStage: stage,
    pathwayStage: stage.nullable(),
    basis: z.enum(['own-stage', 'younger-bridge', 'older-early', 'unavailable']),
    recommendedLessonId: z.string().nullable(),
    /** OD-25: mastery can open (or opened) a chapter one stage early, so a course with no chapter for this age is still offered. */
    earlyAccess: z.boolean().optional(),
  }).optional(),
});
export type ShelfCourse = z.infer<typeof shelfCourseSchema>;

export const shelfSchema = z.object({
  courses: z.array(shelfCourseSchema),
  /** B.3: the learner's featured course could not be assembled right now. */
  unavailableFeaturedCourse: z.object({ slug: z.string().min(1), title: localized }).optional(),
});
export type Shelf = z.infer<typeof shelfSchema>;

/** Why a read failed, as the screens tell it apart: no connection, not allowed, or anything else. */
export type Failure = 'offline' | 'refused' | 'error';

export type ShelfState = { status: 'loading' } | { status: 'ready'; shelf: Shelf } | { status: Failure };

export interface LearnTransport {
  (path: string): Promise<{ data: unknown; error: { code: string; missingPrerequisites?: string[] } | null }>;
}

const REFUSED = new Set(['UNAUTHORIZED', 'FORBIDDEN', 'AGE_SCREEN_REQUIRED', 'ACCOUNT_SUSPENDED']);

/** The failure a Core error code stands for. `NETWORK` is what the host reports when the request never arrived. */
export function failureOf(code: string): Failure {
  if (code === 'NETWORK' || code === 'OFFLINE') return 'offline';
  if (REFUSED.has(code)) return 'refused';
  return 'error';
}

export async function fetchShelf(request: LearnTransport): Promise<ShelfState> {
  let response: Awaited<ReturnType<LearnTransport>>;
  try {
    response = await request('/learn/courses');
  } catch {
    return { status: 'offline' };
  }
  if (response.error) return { status: failureOf(response.error.code) };
  const parsed = shelfSchema.safeParse(response.data);
  return parsed.success ? { status: 'ready', shelf: parsed.data } : { status: 'error' };
}

/** A course the age safeguard closes for this learner: listed, never offered (OD-16, B.6). */
export const isClosedByAge = (course: ShelfCourse) => course.pathway?.basis === 'unavailable' && course.pathway.earlyAccess !== true;
export const isStarted = (course: ShelfCourse) => course.progress.passed > 0;
export const isDone = (course: ShelfCourse) => course.progress.total > 0 && course.progress.passed >= course.progress.total;

/**
 * The one course to resume (as the legacy home chose it): in progress first,
 * then unstarted, then the first open one. A course closed by age is never
 * featured.
 */
export function featuredCourse(courses: readonly ShelfCourse[]): ShelfCourse | null {
  const open = courses.filter((course) => !isClosedByAge(course));
  return open.find((course) => isStarted(course) && !isDone(course))
    ?? open.find((course) => !isDone(course))
    ?? open[0]
    ?? null;
}

/** The shelf in reading order: the featured course leads, the rest keep Core's order. */
export function shelfOrder(courses: readonly ShelfCourse[], featured: ShelfCourse | null): ShelfCourse[] {
  return featured ? [featured, ...courses.filter((course) => course.id !== featured.id)] : [...courses];
}

/*
 * Course identity (Bible 02 §4.3): each course is told apart three ways at
 * once, by hue, by its own icon and by its title. The four published courses
 * map onto the four identity slots; a course with no slot yet gets a neutral
 * card and no icon rather than a borrowed identity (proposal for the owner in
 * docs/rebuild/sprints/W2-LEARNER.md).
 */
export type CourseHue = 'primary' | 'mint' | 'berry' | 'sky';
export interface CourseIdentity { hue: CourseHue; iconAssetId: string }

export const COURSE_IDENTITY: Readonly<Record<string, CourseIdentity>> = {
  'first-lemonade-stand': { hue: 'primary', iconAssetId: 'course.first-steps.icon' },
  'financial-education': { hue: 'mint', iconAssetId: 'course.money-basics.icon' },
  entrepreneurship: { hue: 'berry', iconAssetId: 'course.business.icon' },
  investing: { hue: 'sky', iconAssetId: 'course.investing.icon' },
};

export function courseIdentity(slug: string): CourseIdentity | null {
  return Object.prototype.hasOwnProperty.call(COURSE_IDENTITY, slug) ? COURSE_IDENTITY[slug]! : null;
}
