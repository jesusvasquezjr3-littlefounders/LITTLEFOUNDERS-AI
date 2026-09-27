import type { AdventureNode, CourseTree, LessonNode, TopicNode } from '../courseTree.js';
import type { LessonState } from '../unlockRules.js';
import {
  chapterOpensForAge,
  chapterPolicy,
  computeFrontier,
  earlyChapterDecision,
  gradedPathwayProgress,
  graphState,
  mentorMasteryOffers,
  pathwayBadgeDecision,
  pathwayProgress,
  resolvePathway,
  topicCompletion,
  type AgeEvidence,
  type ChapterAccess,
  type ChapterPolicy,
  type ChapterRowLite,
  type EarlyChapterStatus,
  type Frontier,
  type FrontierItem,
  type KcSatisfaction,
  type LearnerEvidence,
  type PathwayBasis,
  type PathwayChapter,
  type PathwayStage,
  type PathwayTopic,
  type TopicKcs,
} from './pathwayPolicy.js';

/*
 * B.6 / S05.3b — the pathway engine applied to one learner's course tree.
 *
 * pathwayPolicy.ts owns the rules; this module is the adapter between those
 * rules and the CourseTree shape every learner route already serves. It takes
 * a tree assembled by courseTree.ts (the published hierarchy plus this
 * learner's passes and placement credits) and replaces the linear lock state
 * with the pathway's:
 *
 *   - lesson state comes from the frontier (F1–F8), not from one flat order;
 *   - chapter state and access come from age eligibility (P1–P5), so a closed
 *     chapter is locked for every lesson in it whatever the learner has shown;
 *   - course progress is the pathway's (B1–B3), never another stage's lessons;
 *   - placement is required per pathway stage (P6), and the badge decision is
 *     the staged credential (B4–B5).
 *
 * Pure and deterministic: same tree and inputs, same output. Every read lives
 * in pathwayData.ts, so the rules stay testable on plain fixtures. The tree
 * keeps its shape (the admission gate `state === 'locked'` in routes/learn.ts
 * is unchanged) and gains a `pathway` section for the rebuilt course path.
 */

/** The server's pathway view of one course for one learner. Age evidence never leaves Core; only the resulting stage does. */
export interface PathwayView {
  engine: 'pathway';
  learnerStage: PathwayStage;
  /** The stage whose chapters this learner's completion is measured on; null when the course is unavailable to them. */
  pathwayStage: PathwayStage | null;
  basis: PathwayBasis;
  /** Every item the learner may start now. The first pathway item is the recommendation (F4). */
  frontier: PathwayFrontierItem[];
  /** Playable items in optional chapters: never required, never counted (P5, B3). */
  optional: PathwayFrontierItem[];
  /** Topics whose skills are already shown (course or Mentor) but that are not the next step of their saga (F8). */
  known: PathwayFrontierItem[];
  blocked: PathwayBlockedItem[];
  /** Unsatisfied prerequisites taught only outside the pathway: suggested, never required (F2, F5). */
  advisorySkills: string[];
  progress: { passed: number; total: number; pct: number; skillsTaught: number; skillsShown: number; complete: boolean };
  badge: {
    earnedStages: PathwayStage[]; eligible: boolean; stage: PathwayStage | null; contentGap: boolean;
    /**
     * Pathway topics complete only through an accepted Mentor-mastery offer
     * (E3). They do not count toward the stage badge (B6); playing their
     * lessons does. 0 when there are none.
     */
    awaitingGradedTopics: number;
  };
  placement: { required: boolean; stage: PathwayStage | null };
  /** The skills the pathway teaches, in pathway order, with how each is currently shown. */
  skills: Array<{ key: string; shown: KcSatisfaction }>;
  /**
   * Where earlier evidence (Mentor mastery, skills shown in another stage)
   * suggests the stage-entry placement should ask its first question: a prior,
   * never a verdict (P6). Null when there is no graph evidence to offer.
   */
  graphPriorFraction: number | null;
  /**
   * OD-25 / P-03 (Rule P8): every chapter one stage above the learner that the
   * early-access rule speaks about. 'confirmed' chapters are open (their
   * chapter access is 'optional' or 'pathway'); the others are still closed.
   */
  earlyChapters: PathwayEarlyChapter[];
  /** OD-25 / P-04 (Rule E3): topics the learner may complete with the mastery shown to the Mentor, if they accept. */
  masteryOffers: Array<{ topicId: string; chapterId: string; skills: string[] }>;
  /** Topics completed by an accepted Mentor-mastery offer, with their first unplayed lesson (still playable). */
  masteryCompleted: Array<{ topicId: string; chapterId: string; lessonId: string | null }>;
}

export interface PathwayEarlyChapter {
  chapterId: string;
  stage: PathwayStage;
  status: EarlyChapterStatus | 'confirmed';
  prerequisiteSkills: string[];
  missingSkills: string[];
}

export type PathwayItemReason = FrontierItem['reason'] | 'known';

export interface PathwayFrontierItem {
  lessonId: string;
  topicId: string;
  chapterId: string;
  reason: PathwayItemReason;
  access: 'pathway' | 'optional';
}

export interface PathwayBlockedItem {
  topicId: string;
  /** Skills an earlier pathway topic teaches that are not shown yet. */
  missingSkills: string[];
  /** Earlier pathway topics (ids) that must be finished first. */
  missingTopicIds: string[];
}

export type PathwayAdventureNode = AdventureNode & { pathwayAccess: ChapterAccess; pathwayStage: PathwayStage | null };
export type PathwayTopicNode = TopicNode & { skills: string[] };
export type PathwayCourseTree = Omit<CourseTree, 'adventures'> & { adventures: PathwayAdventureNode[]; pathway: PathwayView };

export interface CoursePathwayInputs {
  /** Eligibility columns per adventure id (age_tier plus the explicit pathway columns). */
  chapters: ReadonlyMap<string, ChapterRowLite>;
  /** ACTIVE shared KCs each topic teaches or reviews, by topic id (the same set the Mentor reads). */
  topicKcs: ReadonlyMap<string, TopicKcs>;
  /** Mentor-graph prerequisites between ACTIVE KCs, by dependent KC key. */
  kcPrerequisites: ReadonlyMap<string, readonly string[]>;
  age: AgeEvidence;
  /** Mentor BKT posterior by KC key (learner_kc_mastery). */
  mentorPKnown: ReadonlyMap<string, number>;
  /** KC keys whose Mentor memory card is due now (memory_card). */
  dueReviewKcs: ReadonlySet<string>;
  /** Stage credentials already held in this course (stored badges plus the legacy live rule, Rule B5). */
  earnedStages: ReadonlySet<PathwayStage>;
  /** Stages with an entry placement in this course (course_pathway_placements). */
  placedStages: ReadonlySet<PathwayStage>;
  /** A B.1 course_placements row exists for this course. */
  hasLegacyPlacement: boolean;
  /** OD-25 / P-03: chapter ids of this course with a stored early-access confirmation (Rule P8). */
  earlyConfirmedChapterIds?: ReadonlySet<string>;
  /** OD-25 / P-04: this course's mastery-offer decisions by topic id (Rule E3). */
  masteryDecisions?: ReadonlyMap<string, 'accepted' | 'declined'>;
}

const byPosition = <T extends { position: number }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.position - b.position);

/**
 * The stage a course's legacy chapters formed at cutover: the one stage every
 * legacy-policy chapter shares, or null when they disagree or none exist. A
 * B.1 course_placements row is the entry placement of exactly this stage (P6),
 * and a live full-course badge is the credential of exactly this stage (B5).
 */
export function legacyCourseStage(policies: ReadonlyArray<ChapterPolicy | null>): PathwayStage | null {
  const stages = new Set(policies.filter((p): p is ChapterPolicy => p !== null && p.source === 'legacy-age-tier').map((p) => p.stage));
  return stages.size === 1 ? [...stages][0]! : null;
}

/** Rebuild the pathway structures from an assembled tree. Paths are "<adventure>/<saga>/<topic>", the KC map's key. */
function chaptersFromTree(tree: CourseTree, inputs: CoursePathwayInputs): {
  chapters: PathwayChapter[];
  kcsByPath: Map<string, TopicKcs>;
  topicIdByPath: Map<string, string>;
  evidence: LearnerEvidence;
} {
  const kcsByPath = new Map<string, TopicKcs>();
  const topicIdByPath = new Map<string, string>();
  const passed = new Set<string>();
  const credited = new Set<string>();
  const chapters: PathwayChapter[] = tree.adventures.map((adventure) => {
    const row = inputs.chapters.get(adventure.id);
    return {
      id: adventure.id,
      position: adventure.position,
      // A chapter with no eligibility row is CLOSED (null policy), never guessed (P1).
      policy: row ? chapterPolicy(row) : null,
      sagas: adventure.sagas.map((saga) => ({
        id: saga.id,
        position: saga.position,
        topics: saga.topics.map((topic): PathwayTopic => {
          const path = `${adventure.slug}/${saga.slug}/${topic.slug}`;
          topicIdByPath.set(path, topic.id);
          const kcs = inputs.topicKcs.get(topic.id);
          if (kcs) kcsByPath.set(path, kcs);
          for (const lesson of topic.lessons) {
            if (lesson.placementCredited) credited.add(lesson.id);
            else if (lesson.state === 'passed') passed.add(lesson.id);
          }
          return {
            id: topic.id,
            path,
            position: topic.position,
            kind: (['teaching', 'review_spaced', 'review_interleaved', 'review_quest'] as const).find((k) => k === topic.kind) ?? 'teaching',
            lessonIds: byPosition(topic.lessons).map((l) => l.id),
            hardPrerequisites: topic.prerequisites.filter((p) => p.strength === 'hard').map((p) => p.path),
            reviewOf: topic.reviewOf,
          };
        }),
      })),
    };
  });
  const accepted = new Set([...(inputs.masteryDecisions ?? new Map()).entries()].filter(([, d]) => d === 'accepted').map(([id]) => id));
  return {
    chapters,
    kcsByPath,
    topicIdByPath,
    evidence: {
      passedLessonIds: passed, creditedLessonIds: credited, mentorPKnown: inputs.mentorPKnown, dueReviewKcs: inputs.dueReviewKcs,
      masteryCompletedTopicIds: accepted,
    },
  };
}

/**
 * F8 (S05.3b) — a skill already shown is never locked. A topic whose every
 * taught KC is satisfied (a complete topic elsewhere, in any open chapter, or
 * the Mentor's posterior at its own 0.80 bar) opens its first unpassed lesson
 * even when it is not yet its saga's next step. It is never recommended ahead
 * of the frontier and never completed by that evidence alone (B2): the
 * learner can play it, and completion needs graded lessons, placement credit
 * or the learner's acceptance of the Mentor-mastery offer (E3, OD-25 / P-04).
 */
function knownTopics(
  chapters: readonly PathwayChapter[],
  access: ReadonlyMap<string, ChapterAccess>,
  kcsByPath: ReadonlyMap<string, TopicKcs>,
  satisfaction: ReadonlyMap<string, KcSatisfaction>,
  evidence: LearnerEvidence,
  alreadyOffered: ReadonlySet<string>,
): PathwayFrontierItem[] {
  const out: PathwayFrontierItem[] = [];
  for (const chapter of byPosition(chapters)) {
    const chapterAccess = access.get(chapter.id) ?? 'closed';
    if (chapterAccess === 'closed') continue;
    for (const saga of byPosition(chapter.sagas)) {
      for (const topic of byPosition(saga.topics)) {
        if (alreadyOffered.has(topic.id) || topicCompletion(topic, evidence).complete) continue;
        const teaches = kcsByPath.get(topic.path)?.teaches ?? [];
        if (teaches.length === 0 || !teaches.every((kc) => (satisfaction.get(kc) ?? 'none') !== 'none')) continue;
        const lessonId = topic.lessonIds.find((id) => !evidence.passedLessonIds.has(id) && !evidence.creditedLessonIds.has(id));
        if (lessonId) out.push({ lessonId, topicId: topic.id, chapterId: chapter.id, reason: 'known', access: chapterAccess });
      }
    }
  }
  return out;
}

/** Optional chapters get their own frontier with the same rules, computed as if they were the pathway; never required (P5). */
function optionalFrontier(
  chapters: readonly PathwayChapter[],
  access: ReadonlyMap<string, ChapterAccess>,
  kcsByPath: ReadonlyMap<string, TopicKcs>,
  prerequisites: ReadonlyMap<string, readonly string[]>,
  evidence: LearnerEvidence,
): FrontierItem[] {
  if (![...access.values()].includes('optional')) return [];
  // Swap roles: optional chapters are walked as a pathway; pathway chapters
  // stay open (their completions still satisfy KCs, E2) but are not walked.
  const swapped = new Map<string, ChapterAccess>();
  for (const [id, a] of access) swapped.set(id, a === 'optional' ? 'pathway' : a === 'pathway' ? 'optional' : 'closed');
  return computeFrontier(chapters, swapped, kcsByPath, prerequisites, evidence).items
    .filter((item) => item.access === 'pathway')
    .map((item) => ({ ...item, access: 'optional' as const, reason: item.reason === 'review-due' ? 'review' : item.reason }));
}

/**
 * P6 prior for the stage-entry placement: the position, in pathway placement
 * order, of the first topic whose taught skills are not all shown yet — only
 * when some topic's skills ARE all shown, so an unmapped or fresh graph never
 * drags the first question down.
 */
function graphPrior(chapters: readonly PathwayChapter[], access: ReadonlyMap<string, ChapterAccess>, kcsByPath: ReadonlyMap<string, TopicKcs>, satisfaction: ReadonlyMap<string, KcSatisfaction>): number | null {
  const topics = byPosition(chapters)
    .filter((c) => access.get(c.id) === 'pathway')
    .flatMap((c) => byPosition(c.sagas).flatMap((s) => byPosition(s.topics)))
    .filter((t) => t.lessonIds.length > 0);
  if (topics.length === 0) return null;
  const shown = (t: PathwayTopic): boolean | null => {
    const teaches = kcsByPath.get(t.path)?.teaches ?? [];
    return teaches.length === 0 ? null : teaches.every((kc) => (satisfaction.get(kc) ?? 'none') !== 'none');
  };
  if (!topics.some((t) => shown(t) === true)) return null;
  const firstUnshown = topics.findIndex((t) => shown(t) === false);
  return (firstUnshown === -1 ? topics.length : firstUnshown) / topics.length;
}

/** Apply the pathway engine to an assembled tree. The input tree is not mutated. */
export function applyCoursePathway(tree: CourseTree, inputs: CoursePathwayInputs): PathwayCourseTree {
  const { chapters, kcsByPath, topicIdByPath, evidence } = chaptersFromTree(tree, inputs);
  const resolution = resolvePathway(inputs.age, chapters.map((c) => ({ id: c.id, policy: c.policy })), inputs.earlyConfirmedChapterIds ?? new Set());
  const { access } = resolution;
  const frontier: Frontier = computeFrontier(chapters, access, kcsByPath, inputs.kcPrerequisites, evidence);
  const optional = optionalFrontier(chapters, access, kcsByPath, inputs.kcPrerequisites, evidence);
  const { satisfaction } = graphState(chapters, access, kcsByPath, evidence);
  const offered = new Set([...frontier.items, ...optional].map((i) => i.topicId));
  const known = knownTopics(chapters, access, kcsByPath, satisfaction, evidence, offered);
  const progress = pathwayProgress(chapters, access, kcsByPath, evidence);
  // B6 (OD-25 / P-04): the badge is decided on graded evidence only; accepted Mentor completions are left out.
  const graded = gradedPathwayProgress(chapters, access, kcsByPath, evidence);
  const badge = pathwayBadgeDecision(resolution, graded, inputs.earnedStages);
  const decided = new Set((inputs.masteryDecisions ?? new Map()).keys());
  const masteryOffers = mentorMasteryOffers(chapters, access, kcsByPath, evidence, decided);
  const masteryCompleted = byPosition(chapters)
    .filter((c) => (access.get(c.id) ?? 'closed') !== 'closed')
    .flatMap((c) => byPosition(c.sagas).flatMap((s) => byPosition(s.topics).map((t) => ({ chapter: c, topic: t }))))
    .filter(({ topic }) => topic.lessonIds.length > 0 && evidence.masteryCompletedTopicIds?.has(topic.id))
    .map(({ chapter, topic }) => ({
      topicId: topic.id,
      chapterId: chapter.id,
      lessonId: topic.lessonIds.find((id) => !evidence.passedLessonIds.has(id) && !evidence.creditedLessonIds.has(id)) ?? null,
    }));
  const awaitingGradedTopics = chapters
    .filter((c) => access.get(c.id) === 'pathway')
    .flatMap((c) => c.sagas.flatMap((s) => s.topics))
    .filter((t) => evidence.masteryCompletedTopicIds?.has(t.id) && !topicCompletion(t, { ...evidence, masteryCompletedTopicIds: new Set() }).complete)
    .length;
  // P8 (OD-25 / P-03): confirmed early chapters, then what the rule says about every other closed chapter one stage up.
  const earlyChapters: PathwayEarlyChapter[] = [];
  for (const chapter of byPosition(chapters)) {
    if (!chapter.policy) continue;
    const open = (access.get(chapter.id) ?? 'closed') !== 'closed';
    if (open && !chapterOpensForAge(inputs.age, chapter.policy)) {
      earlyChapters.push({ chapterId: chapter.id, stage: chapter.policy.stage, status: 'confirmed', prerequisiteSkills: [], missingSkills: [] });
      continue;
    }
    if (open) continue;
    const decision = earlyChapterDecision(inputs.age, chapter, kcsByPath, inputs.kcPrerequisites, satisfaction);
    if (decision) {
      earlyChapters.push({ chapterId: chapter.id, stage: chapter.policy.stage, status: decision.status, prerequisiteSkills: decision.prerequisiteKcs, missingSkills: decision.missingKcs });
    }
  }
  const legacyStage = legacyCourseStage(chapters.map((c) => c.policy));
  const stage = resolution.pathwayStage;
  const placementRequired = stage !== null && !inputs.placedStages.has(stage) && !(inputs.hasLegacyPlacement && legacyStage === stage);

  // Lesson states: the frontier's first pathway item is `current`, every other
  // offered lesson is `available`, passed and credited lessons stay `passed`,
  // and everything else — every lesson of a closed chapter included — is locked.
  const recommended = frontier.items.find((i) => i.access === 'pathway')?.lessonId ?? null;
  const openLessons = new Set([...frontier.items, ...optional, ...known].map((i) => i.lessonId));
  // E3: a topic completed by accepted Mentor mastery keeps every unplayed lesson playable, so the learner can still earn it by grade (B6).
  for (const chapter of chapters) {
    if ((access.get(chapter.id) ?? 'closed') === 'closed') continue;
    for (const saga of chapter.sagas) for (const topic of saga.topics) if (evidence.masteryCompletedTopicIds?.has(topic.id)) topic.lessonIds.forEach((id) => openLessons.add(id));
  }
  const lessonState = (lesson: LessonNode, chapterAccess: ChapterAccess): LessonState => {
    if (lesson.state === 'passed') return 'passed';
    if (chapterAccess === 'closed') return 'locked';
    if (lesson.id === recommended) return 'current';
    return openLessons.has(lesson.id) ? 'available' : 'locked';
  };

  const skillsOrder: string[] = [];
  const adventures: PathwayAdventureNode[] = tree.adventures.map((adventure) => {
    const chapterAccess = access.get(adventure.id) ?? 'closed';
    const policy = chapters.find((c) => c.id === adventure.id)?.policy ?? null;
    const sagas = adventure.sagas.map((saga) => ({
      ...saga,
      topics: saga.topics.map((topic): PathwayTopicNode => {
        const teaches = [...(inputs.topicKcs.get(topic.id)?.teaches ?? [])];
        if (chapterAccess === 'pathway') for (const kc of teaches) if (!skillsOrder.includes(kc)) skillsOrder.push(kc);
        return { ...topic, skills: teaches, lessons: topic.lessons.map((lesson) => ({ ...lesson, state: lessonState(lesson, chapterAccess) })) };
      }),
    }));
    const lessonIds = sagas.flatMap((s) => s.topics.flatMap((t) => t.lessons));
    const complete = lessonIds.length > 0 && lessonIds.every((l) => l.state === 'passed');
    return {
      ...adventure,
      sagas,
      state: chapterAccess === 'closed' ? 'locked' : complete ? 'completed' : 'available',
      pathwayAccess: chapterAccess,
      pathwayStage: policy?.stage ?? null,
    };
  });

  const toItem = (item: FrontierItem | PathwayFrontierItem): PathwayFrontierItem =>
    ({ lessonId: item.lessonId, topicId: item.topicId, chapterId: item.chapterId, reason: item.reason, access: item.access });
  const pathway: PathwayView = {
    engine: 'pathway',
    learnerStage: resolution.learnerStage,
    pathwayStage: stage,
    basis: resolution.basis,
    frontier: frontier.items.map(toItem),
    optional: optional.map(toItem),
    known,
    blocked: frontier.blocked.map((b) => ({
      topicId: topicIdByPath.get(b.topicPath) ?? b.topicPath,
      missingSkills: b.missingKcs,
      missingTopicIds: b.missingTopics.flatMap((p) => {
        const direct = topicIdByPath.get(p);
        if (direct) return [direct];
        return [...topicIdByPath.entries()].filter(([path]) => path.startsWith(`${p}/`)).map(([, id]) => id);
      }),
    })),
    advisorySkills: frontier.advisoryKcs,
    progress: { passed: progress.passed, total: progress.total, pct: progress.pct, skillsTaught: progress.kcsTaught, skillsShown: progress.kcsSatisfied, complete: progress.complete },
    badge: { earnedStages: [...inputs.earnedStages].sort(), eligible: badge.eligible, stage: badge.stage, contentGap: badge.contentGap, awaitingGradedTopics },
    placement: { required: placementRequired, stage },
    skills: skillsOrder.map((key) => ({ key, shown: satisfaction.get(key) ?? 'none' })),
    graphPriorFraction: graphPrior(chapters, access, kcsByPath, satisfaction),
    earlyChapters,
    masteryOffers: masteryOffers.map((o) => ({ topicId: o.topicId, chapterId: o.chapterId, skills: o.kcs })),
    masteryCompleted,
  };

  return {
    ...tree,
    course: {
      ...tree.course,
      progress: { passed: progress.passed, total: progress.total, pct: progress.pct },
      placementRequired,
    },
    adventures,
    nextLessonId: recommended,
    pathway,
  };
}

/** Which access the chapter holding `lessonId` has, or null when the lesson is not in the tree. */
export function lessonChapterAccess(tree: { adventures: ReadonlyArray<AdventureNode & { pathwayAccess?: ChapterAccess }> }, lessonId: string): ChapterAccess | null {
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        if (topic.lessons.some((l) => l.id === lessonId)) return adventure.pathwayAccess ?? 'pathway';
      }
    }
  }
  return null;
}

/** The badge row a completed pathway earns (Rule B4). Null when nothing new is earned. */
export function pathwayBadgeAward(view: PathwayView): { award_key: PathwayStage; pathway_stage: PathwayStage; basis: 'own_stage' | 'younger_bridge' | 'older_early' } | null {
  if (!view.badge.eligible || view.badge.stage === null) return null;
  const basis = view.basis === 'own-stage' ? 'own_stage' : view.basis === 'younger-bridge' ? 'younger_bridge' : view.basis === 'older-early' ? 'older_early' : null;
  return basis ? { award_key: view.badge.stage, pathway_stage: view.badge.stage, basis } : null;
}
