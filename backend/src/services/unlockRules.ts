/*
 * Pure unlock-rule computation — COURSE_ENGINE.md §2: "the course-tree
 * endpoint returns locked/available/current/passed per node. No client
 * re-derivation." Core is the SINGLE SOURCE OF TRUTH for this; the frontend
 * only ever renders whatever state this module computes.
 *
 * Kept dependency-free and side-effect-free on purpose (no PostgREST/fetch
 * here) so it is unit-testable with plain fixtures — see
 * src/__tests__/unlockRules.test.ts.
 *
 * State-assignment precedence (per lesson, walking the GLOBAL order —
 * adventure.position, saga.position, topic.position, lesson.position):
 *   1. `lesson_progress.passed === true`             → 'passed'
 *   2. it is the first non-passed lesson encountered  → 'current'
 *   3. it comes BEFORE that first non-passed lesson    → 'available'
 *      (defensive: under strict sequential play this bucket is empty —
 *      "current" is defined as the first non-passed lesson, so everything
 *      earlier is passed by construction — but content can be reordered
 *      after progress was recorded, so this is a real, reachable state, not
 *      dead code)
 *   4. everything after                                → 'locked'
 */

export type LessonState = 'locked' | 'available' | 'current' | 'passed';
export type AdventureState = 'locked' | 'available' | 'completed';

export interface FlatLesson {
  id: string;
}

export interface UnlockResult {
  states: Map<string, LessonState>;
  /** First non-passed lesson in global order, or null if every lesson is passed (course complete) or there are none. */
  currentLessonId: string | null;
}

/** `orderedLessons` MUST already be sorted by the global (adventure, saga, topic, lesson) position tuple. */
export function computeLessonStates(orderedLessons: readonly FlatLesson[], passedLessonIds: ReadonlySet<string>): UnlockResult {
  const currentIndex = orderedLessons.findIndex((l) => !passedLessonIds.has(l.id));
  const states = new Map<string, LessonState>();

  orderedLessons.forEach((lesson, i) => {
    if (passedLessonIds.has(lesson.id)) {
      states.set(lesson.id, 'passed');
    } else if (currentIndex === -1 || i > currentIndex) {
      states.set(lesson.id, 'locked');
    } else if (i === currentIndex) {
      states.set(lesson.id, 'current');
    } else {
      states.set(lesson.id, 'available');
    }
  });

  const currentLessonId = currentIndex === -1 ? null : (orderedLessons[currentIndex]?.id ?? null);
  return { states, currentLessonId };
}

/**
 * Adventure state: locked if any lesson of the PREVIOUS adventure isn't
 * passed yet; else available (unlocked, not fully cleared) or completed
 * (every one of ITS OWN lessons is passed). `previousAdventureLessonIds`
 * is `null` for the first adventure (nothing gates it).
 */
export function computeAdventureState(
  ownLessonIds: readonly string[],
  previousAdventureLessonIds: readonly string[] | null,
  passedLessonIds: ReadonlySet<string>,
): AdventureState {
  const previousCleared = previousAdventureLessonIds === null || previousAdventureLessonIds.every((id) => passedLessonIds.has(id));
  if (!previousCleared) return 'locked';
  const ownCleared = ownLessonIds.length > 0 && ownLessonIds.every((id) => passedLessonIds.has(id));
  return ownCleared ? 'completed' : 'available';
}

export function progressOf(lessonIds: readonly string[], passedLessonIds: ReadonlySet<string>): { passed: number; total: number; pct: number } {
  const total = lessonIds.length;
  const passed = lessonIds.filter((id) => passedLessonIds.has(id)).length;
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);
  return { passed, total, pct };
}
