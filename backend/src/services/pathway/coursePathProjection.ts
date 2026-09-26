import type { Localized } from '../pedagogy/kcData.js';
import type { PathwayCourseTree, PathwayFrontierItem, PathwayItemReason } from './coursePathway.js';
import type { ChapterAccess, KcSatisfaction, PathwayBasis, PathwayStage } from './pathwayPolicy.js';

/*
 * B.6 / S05.3b — GET /learn/courses/:slug/path. The rebuilt course path needs
 * one learner-sized answer, not the whole tree (the financial-education tree
 * carries every lesson of every chapter): which chapters are theirs, what they
 * can start now and why, what waits and on what, and the skills the pathway
 * teaches. Everything here is projected from the SAME pathway tree the lesson
 * gate uses, so the screen can never offer a lesson the server would refuse.
 *
 * Titles travel as the catalog's localized objects; the client picks the
 * locale. No age, birth date or score leaves Core: only stages and states.
 */

type Json = Record<string, unknown>;

export interface SkillRef { key: string; title: Localized }

export interface CoursePathProjection {
  course: { slug: string; title: Json; badgeAsset: string | null; progress: { passed: number; total: number; pct: number } };
  pathway: {
    learnerStage: PathwayStage;
    pathwayStage: PathwayStage | null;
    basis: PathwayBasis;
    placementRequired: boolean;
    badge: { earnedStages: PathwayStage[]; eligible: boolean; stage: PathwayStage | null; contentGap: boolean };
    progress: { passed: number; total: number; pct: number; skillsTaught: number; skillsShown: number; complete: boolean };
    advisorySkills: SkillRef[];
  };
  chapters: Array<{
    id: string; slug: string; title: Json; position: number;
    access: ChapterAccess; stage: PathwayStage | null; state: 'locked' | 'available' | 'completed';
    progress: { passed: number; total: number; pct: number };
  }>;
  items: Array<{
    lessonId: string; lessonTitle: Json; topicId: string; topicTitle: Json; chapterId: string;
    reason: PathwayItemReason; access: 'pathway' | 'optional'; estimatedMinutes: number; recommended: boolean;
  }>;
  blocked: Array<{ topicId: string; topicTitle: Json; chapterId: string; missingSkills: SkillRef[]; missingTopics: Array<{ id: string; title: Json }> }>;
  skills: Array<SkillRef & { shown: KcSatisfaction }>;
}

export function projectCoursePath(tree: PathwayCourseTree, kcTitles: ReadonlyMap<string, Localized>): CoursePathProjection {
  const topicIndex = new Map<string, { title: Json; chapterId: string }>();
  const lessonIndex = new Map<string, { title: Json; minutes: number }>();
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        topicIndex.set(topic.id, { title: topic.title, chapterId: adventure.id });
        for (const lesson of topic.lessons) lessonIndex.set(lesson.id, { title: lesson.title, minutes: lesson.estimated_minutes });
      }
    }
  }
  const skill = (key: string): SkillRef => ({ key, title: kcTitles.get(key) ?? {} });
  const view = tree.pathway;
  const item = (entry: PathwayFrontierItem) => ({
    lessonId: entry.lessonId,
    lessonTitle: lessonIndex.get(entry.lessonId)?.title ?? {},
    topicId: entry.topicId,
    topicTitle: topicIndex.get(entry.topicId)?.title ?? {},
    chapterId: entry.chapterId,
    reason: entry.reason,
    access: entry.access,
    estimatedMinutes: lessonIndex.get(entry.lessonId)?.minutes ?? 0,
    recommended: entry.lessonId === tree.nextLessonId,
  });
  return {
    course: { slug: tree.course.slug, title: tree.course.title, badgeAsset: tree.course.badgeAsset, progress: tree.course.progress },
    pathway: {
      learnerStage: view.learnerStage,
      pathwayStage: view.pathwayStage,
      basis: view.basis,
      placementRequired: view.placement.required,
      badge: view.badge,
      progress: view.progress,
      advisorySkills: view.advisorySkills.map(skill),
    },
    chapters: tree.adventures.map((adventure) => ({
      id: adventure.id,
      slug: adventure.slug,
      title: adventure.title,
      position: adventure.position,
      access: adventure.pathwayAccess,
      stage: adventure.pathwayStage,
      state: adventure.state,
      progress: adventure.progress,
    })),
    items: [...view.frontier, ...view.optional, ...view.known].map(item),
    blocked: view.blocked.map((b) => ({
      topicId: b.topicId,
      topicTitle: topicIndex.get(b.topicId)?.title ?? {},
      chapterId: topicIndex.get(b.topicId)?.chapterId ?? '',
      missingSkills: b.missingSkills.map(skill),
      missingTopics: b.missingTopicIds.map((id) => ({ id, title: topicIndex.get(id)?.title ?? {} })),
    })),
    skills: view.skills.map((s) => ({ ...skill(s.key), shown: s.shown })),
  };
}
