/*
 * The Lesson Player's URL, declared ONCE.
 *
 * This module exists because of a defect, not because of tidiness. On
 * 2026-09-04 the rebuilt /learn chapter list hand-wrote its link as
 * `/learn/${courseSlug}/lesson/${lesson.slug}` — a path shape the router has
 * never served, keyed by a slug where the player reads a UUID. React Router
 * matched nothing, <Routes> rendered nothing, and every lesson opened from the
 * learn home was a white screen for a week. Four other call sites had it right;
 * the fifth could be wrong precisely because each one spelled it out again.
 *
 * So the route PATTERN and the link BUILDER are now the same fact in the same
 * file. App.tsx registers LESSON_ROUTE_PATH; everything that navigates calls
 * lessonPath(). They cannot drift, because changing one without the other no
 * longer type-checks or passes paths.test.ts.
 *
 * Keyed by `lesson.id` (a UUID), never `lesson.slug`: LessonRoute reads
 * :lessonId straight into GET /learn/lessons/:id, and Core looks that up by id.
 */

/**
 * The pattern as <Route path> wants it: RELATIVE, because the lesson route is
 * declared directly inside the root <Routes> in App.tsx.
 */
export const LESSON_ROUTE_PATH = 'learn/lesson/:lessonId' as const;

/**
 * The absolute URL for a lesson, for `to=` / `navigate()`.
 *
 * Pass `{ state: { courseSlug } }` alongside it wherever the origin course is
 * known — the player uses that state, and only that state, to decide where
 * "exit lesson" goes (LessonRoute.tsx). Without it, exiting lands on /learn.
 */
export function lessonPath(lessonId: string): string {
  return `/${LESSON_ROUTE_PATH.replace(':lessonId', lessonId)}`;
}

/* The rest of /learn's URLs, gathered here for the same reason: each of them
 * was written out by hand in two or three files, which is the condition that
 * produced the lesson-link defect. */

export const COURSE_ROUTE_PATH = 'learn/:courseSlug' as const;
export const PLACEMENT_ROUTE_PATH = 'learn/:courseSlug/placement' as const;
export const TERRITORY_ROUTE_PATH = 'learn/:courseSlug/territory' as const;
/** B.6 (S05.3b): the rebuilt course path on the pathway engine. */
export const COURSE_PATH_ROUTE_PATH = 'learn/:courseSlug/path' as const;
/** B.9 (S05.3c): the learner's decision journal. A static segment, so it ranks above learn/:courseSlug. */
export const DECISION_JOURNAL_ROUTE_PATH = 'learn/journal' as const;
/** B.21 / B.24 (S05.3e): the learner's streak, pace and choices. A static segment, like the journal. */
export const LEARNING_RHYTHM_ROUTE_PATH = 'learn/rhythm' as const;
/** L-04 (OD-27 (1)): teen cooperative goals. A static segment, like the journal. */
export const TOGETHER_ROUTE_PATH = 'learn/together' as const;

export function coursePath(courseSlug: string): string {
  return `/${COURSE_ROUTE_PATH.replace(':courseSlug', courseSlug)}`;
}

/**
 * The placement quiz — the real gate in front of a course's first lesson.
 * Core 403s every lesson-access endpoint with PLACEMENT_REQUIRED until it has
 * been taken (backend/src/routes/learn.ts), so this is where a learner has to
 * end up, not an error banner about it.
 */
export function placementPath(courseSlug: string): string {
  return `/${PLACEMENT_ROUTE_PATH.replace(':courseSlug', courseSlug)}`;
}

export function territoryPath(courseSlug: string): string {
  return `/${TERRITORY_ROUTE_PATH.replace(':courseSlug', courseSlug)}`;
}

export function coursePathPath(courseSlug: string): string {
  return `/${COURSE_PATH_ROUTE_PATH.replace(':courseSlug', courseSlug)}`;
}

export function decisionJournalPath(): string {
  return `/${DECISION_JOURNAL_ROUTE_PATH}`;
}

export function learningRhythmPath(): string {
  return `/${LEARNING_RHYTHM_ROUTE_PATH}`;
}

export function togetherPath(): string {
  return `/${TOGETHER_ROUTE_PATH}`;
}

/**
 * B.26 / OD-1 (S05.3f): the Mentor's guided review of one skill, opened only
 * when the learner accepts the offer. The Mentor starts a weak-skill session
 * for that course/topic key (TutorExperience reads `review`).
 */
export function guidedReviewPath(skillKey: string): string {
  return `/tutor?review=${encodeURIComponent(skillKey)}`;
}

/** The skill key a guided-review link carries, or null when it is not one. */
export function guidedReviewSkillFrom(search: string): string | null {
  const value = new URLSearchParams(search).get('review');
  return value !== null && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(value) ? value : null;
}
