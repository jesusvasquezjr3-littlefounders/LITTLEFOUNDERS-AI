import { computeAdventureState, computeLessonStates, progressOf, type LessonState } from './unlockRules.js';

/*
 * Pure assembly of the COURSE_ENGINE.md §2 hierarchy
 * (courses → adventures → sagas → topics → lessons) plus per-user unlock
 * state, from already-fetched rows. No I/O here — routes/learn.ts fetches
 * rows via services/supabaseRest.ts and hands them to this module, which
 * keeps the shaping/unlock logic unit-testable without mocking fetch.
 */

type Json = Record<string, unknown>;

export interface CourseRowLite {
  id: string;
  slug: string;
  title: Json;
  description: Json;
  subject: string;
}

export interface AdventureRowLite {
  id: string;
  course_id: string;
  position: number;
  slug: string;
  title: Json;
  description: Json;
  theme: string;
}

export interface SagaRowLite {
  id: string;
  adventure_id: string;
  position: number;
  slug: string;
  title: Json;
  icon: string;
}

export interface TopicRowLite {
  id: string;
  saga_id: string;
  position: number;
  slug: string;
  title: Json;
}

export interface LessonRowLite {
  id: string;
  topic_id: string;
  position: number;
  slug: string;
  title: Json;
  difficulty: number;
  xp_total: number;
  estimated_minutes: number;
}

export interface ProgressRowLite {
  lesson_id: string;
  passed: boolean;
  best_score: number;
}

export interface ProgressShape {
  passed: number;
  total: number;
  pct: number;
}

export interface LessonNode {
  id: string;
  slug: string;
  title: Json;
  position: number;
  difficulty: number;
  xp_total: number;
  estimated_minutes: number;
  state: LessonState;
  bestScore: number;
}

export interface TopicNode {
  id: string;
  slug: string;
  title: Json;
  position: number;
  lessons: LessonNode[];
}

export interface SagaNode {
  id: string;
  slug: string;
  title: Json;
  icon: string;
  position: number;
  progress: ProgressShape;
  topics: TopicNode[];
}

export interface AdventureNode {
  id: string;
  slug: string;
  title: Json;
  description: Json;
  theme: string;
  position: number;
  state: 'locked' | 'available' | 'completed';
  progress: ProgressShape;
  sagas: SagaNode[];
}

export interface CourseTree {
  course: {
    id: string;
    slug: string;
    title: Json;
    description: Json;
    subject: string;
    progress: ProgressShape;
  };
  adventures: AdventureNode[];
  nextLessonId: string | null;
}

const byPosition = <T extends { position: number }>(rows: T[]): T[] => [...rows].sort((a, b) => a.position - b.position);

/** Assemble the full per-user tree for ONE course from its already-fetched descendant rows (any order — sorted here). */
export function assembleCourseTree(
  course: CourseRowLite,
  adventureRows: AdventureRowLite[],
  sagaRows: SagaRowLite[],
  topicRows: TopicRowLite[],
  lessonRows: LessonRowLite[],
  progressRows: ProgressRowLite[],
): CourseTree {
  const sagasByAdventure = new Map<string, SagaRowLite[]>();
  for (const s of sagaRows) sagasByAdventure.set(s.adventure_id, [...(sagasByAdventure.get(s.adventure_id) ?? []), s]);

  const topicsBySaga = new Map<string, TopicRowLite[]>();
  for (const t of topicRows) topicsBySaga.set(t.saga_id, [...(topicsBySaga.get(t.saga_id) ?? []), t]);

  const lessonsByTopic = new Map<string, LessonRowLite[]>();
  for (const l of lessonRows) lessonsByTopic.set(l.topic_id, [...(lessonsByTopic.get(l.topic_id) ?? []), l]);

  const bestScoreByLesson = new Map(progressRows.map((p) => [p.lesson_id, p.best_score]));
  const passedLessonIds = new Set(progressRows.filter((p) => p.passed).map((p) => p.lesson_id));

  const sortedAdventures = byPosition(adventureRows);

  // Global flat order (adventure.position, saga.position, topic.position, lesson.position) —
  // COURSE_ENGINE.md §2's single source of truth for unlocking.
  const flatLessons: { id: string }[] = [];
  const lessonIdsByAdventure = new Map<string, string[]>();
  for (const adventure of sortedAdventures) {
    const ownLessonIds: string[] = [];
    for (const saga of byPosition(sagasByAdventure.get(adventure.id) ?? [])) {
      for (const topic of byPosition(topicsBySaga.get(saga.id) ?? [])) {
        for (const lesson of byPosition(lessonsByTopic.get(topic.id) ?? [])) {
          flatLessons.push({ id: lesson.id });
          ownLessonIds.push(lesson.id);
        }
      }
    }
    lessonIdsByAdventure.set(adventure.id, ownLessonIds);
  }

  const { states: lessonStates, currentLessonId } = computeLessonStates(flatLessons, passedLessonIds);

  const adventures: AdventureNode[] = sortedAdventures.map((adventure, i) => {
    const ownLessonIds = lessonIdsByAdventure.get(adventure.id) ?? [];
    const previousAdventure = i > 0 ? sortedAdventures[i - 1] : undefined;
    const previousLessonIds = previousAdventure ? (lessonIdsByAdventure.get(previousAdventure.id) ?? []) : null;

    const sagas: SagaNode[] = byPosition(sagasByAdventure.get(adventure.id) ?? []).map((saga) => {
      const topics: TopicNode[] = byPosition(topicsBySaga.get(saga.id) ?? []).map((topic) => {
        const lessons: LessonNode[] = byPosition(lessonsByTopic.get(topic.id) ?? []).map((lesson) => ({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          position: lesson.position,
          difficulty: lesson.difficulty,
          xp_total: lesson.xp_total,
          estimated_minutes: lesson.estimated_minutes,
          state: lessonStates.get(lesson.id) ?? 'locked',
          bestScore: bestScoreByLesson.get(lesson.id) ?? 0,
        }));
        return { id: topic.id, slug: topic.slug, title: topic.title, position: topic.position, lessons };
      });
      const sagaLessonIds = topics.flatMap((t) => t.lessons.map((l) => l.id));
      return {
        id: saga.id,
        slug: saga.slug,
        title: saga.title,
        icon: saga.icon,
        position: saga.position,
        progress: progressOf(sagaLessonIds, passedLessonIds),
        topics,
      };
    });

    return {
      id: adventure.id,
      slug: adventure.slug,
      title: adventure.title,
      description: adventure.description,
      theme: adventure.theme,
      position: adventure.position,
      state: computeAdventureState(ownLessonIds, previousLessonIds, passedLessonIds),
      progress: progressOf(ownLessonIds, passedLessonIds),
      sagas,
    };
  });

  return {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      subject: course.subject,
      progress: progressOf(
        flatLessons.map((l) => l.id),
        passedLessonIds,
      ),
    },
    adventures,
    nextLessonId: currentLessonId,
  };
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: Json;
  subject: string;
  adventureCount: number;
  lessonCount: number;
  progress: ProgressShape;
}

/** The /learn/courses list shape — a rollup of the same tree, one course at a time. */
export function summarizeCourseTree(course: CourseRowLite, tree: CourseTree): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subject: course.subject,
    adventureCount: tree.adventures.length,
    lessonCount: tree.course.progress.total,
    progress: tree.course.progress,
  };
}

/** Find one lesson's node anywhere in an assembled tree (used to enforce the unlock gate on single-lesson endpoints). */
export function findLessonNode(tree: CourseTree, lessonId: string): LessonNode | null {
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        const found = topic.lessons.find((l) => l.id === lessonId);
        if (found) return found;
      }
    }
  }
  return null;
}
