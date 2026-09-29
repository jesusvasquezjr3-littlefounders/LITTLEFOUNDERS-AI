import type { Localized } from '../pedagogy/kcData.js';
import type { PathwayCourseTree, PathwayFrontierItem, PathwayItemReason } from './coursePathway.js';
import type { ChapterAccess, KcSatisfaction, PathwayBasis, PathwayStage } from './pathwayPolicy.js';
import type { AutonomyOffer } from '../learnerRegisterPolicy.js';

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
  /**
   * GAP-FIX-R5 (B.24, Block B autonomy): the levers the learner's register
   * offers. With `path: 'binary'` (6-9) `items` carries two next steps to pick
   * between (the recommendation first), never the whole frontier.
   */
  autonomy: AutonomyOffer;
  /** GAP-FIX-R5: "Explore further" — optional depth lessons, only where the register offers enrichment. */
  enrichment: CoursePathProjection['items'];
  blocked: Array<{ topicId: string; topicTitle: Json; chapterId: string; missingSkills: SkillRef[]; missingTopics: Array<{ id: string; title: Json }> }>;
  skills: Array<SkillRef & { shown: KcSatisfaction }>;
  /** OD-25: a chapter one stage up that mastery can open (the learner confirms), or has opened. */
  earlyAccess: Array<{ chapterId: string; chapterTitle: Json; stage: PathwayStage; state: 'eligible' | 'opened'; prerequisiteSkills: SkillRef[] }>;
  /** OD-25: topics the learner may accept as done on what they showed with the Mentor. */
  masteryOffers: Array<{ topicId: string; topicTitle: Json; chapterId: string; skills: SkillRef[] }>;
  /** OD-25: topics already accepted as done on Mentor mastery. */
  masteryCreditedTopicIds: string[];
}

export function projectCoursePath(tree: PathwayCourseTree, kcTitles: ReadonlyMap<string, Localized>): CoursePathProjection {
  const topicIndex = new Map<string, { title: Json; chapterId: string }>();
  const chapterTitles = new Map(tree.adventures.map((adventure) => [adventure.id, adventure.title as Json]));
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
    // 6-9 (register mechanism 'topic'): a simple binary choice of the next topic, two recommended frontier items.
    items: [...(view.autonomy.path === 'binary' ? binaryFrontier(view.frontier) : view.frontier), ...view.optional, ...view.known].map(item),
    autonomy: view.autonomy,
    enrichment: view.enrichment.map(item),
    blocked: view.blocked.map((b) => ({
      topicId: b.topicId,
      topicTitle: topicIndex.get(b.topicId)?.title ?? {},
      chapterId: topicIndex.get(b.topicId)?.chapterId ?? '',
      missingSkills: b.missingSkills.map(skill),
      missingTopics: b.missingTopicIds.map((id) => ({ id, title: topicIndex.get(id)?.title ?? {} })),
    })),
    skills: view.skills.map((s) => ({ ...skill(s.key), shown: s.shown })),
    earlyAccess: view.earlyAccess.map((e) => ({ chapterId: e.chapterId, chapterTitle: chapterTitles.get(e.chapterId) ?? {}, stage: e.stage, state: e.state,
      prerequisiteSkills: e.prerequisiteSkills.map(skill) })),
    masteryOffers: view.masteryOffers.map((o) => ({ topicId: o.topicId, topicTitle: topicIndex.get(o.topicId)?.title ?? {}, chapterId: o.chapterId, skills: o.skills.map(skill) })),
    masteryCreditedTopicIds: view.masteryCredited,
  };
}

/** The two next steps a 6-9 learner picks between: the recommendation, then the next pathway item (a different topic). */
export function binaryFrontier(frontier: readonly PathwayFrontierItem[]): PathwayFrontierItem[] {
  const pathway = frontier.filter((entry) => entry.access === 'pathway');
  const first = pathway[0];
  if (!first) return frontier.slice(0, 2);
  const second = pathway.find((entry) => entry.topicId !== first.topicId) ?? frontier.find((entry) => entry.lessonId !== first.lessonId);
  return second ? [first, second] : [first];
}
