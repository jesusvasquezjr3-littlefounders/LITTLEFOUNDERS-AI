import { computeAdventureState, computeLessonStates, progressOf, type LessonState } from './unlockRules.js';
import type { PlacementTopic } from './placementAlgorithm.js';

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
  badge_asset?: string | null;
  in_progress?: boolean;
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

export interface PrerequisiteEdgeLite {
  path: string;
  strength: 'hard' | 'soft';
  reason: string;
}

export interface PlacementProbeLite {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface TopicRowLite {
  id: string;
  saga_id: string;
  position: number;
  slug: string;
  title: Json;
  /** Spaced-review projection (0016). Defaults tolerate pre-0016 rows. */
  kind?: string;
  review_of?: string[];
  /** Competency-graph projection (0042). Defaults tolerate pre-0042 rows — placement.ts (Phase 4) is the consumer. */
  prerequisites?: PrerequisiteEdgeLite[];
  placement_probe?: Partial<Record<'en-US' | 'es-MX' | 'pt-BR', PlacementProbeLite>> | null;
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
  /**
   * Placed past this lesson by the course's placement quiz (0043) — counts
   * toward the badge/progress bar like a real pass (product decision,
   * Duolingo-style), but stays distinguishable everywhere from a lesson
   * actually played: never fabricated XP, never a lesson_progress row.
   */
  placementCredited: boolean;
}

/**
 * Territory-map state per topic — DATA-DERIVED, never self-reported (the
 * roadmap.sh contrast: their 'done' is a checkbox; ours is server-graded
 * passes plus the spaced-review layer).
 *   completed    every lesson passed
 *   review-due   completed, but a review topic citing it still has unpassed lessons
 *   in-progress  some but not all lessons passed
 *   not-started  nothing passed
 */
export type TopicState = 'not-started' | 'in-progress' | 'completed' | 'review-due';

export interface TopicNode {
  id: string;
  slug: string;
  title: Json;
  position: number;
  kind: string;
  reviewOf: string[];
  /** Competency-graph projection (0042) — Phase 4's placement.ts consumes these; carried through inertly here. */
  prerequisites: PrerequisiteEdgeLite[];
  placementProbe: Partial<Record<'en-US' | 'es-MX' | 'pt-BR', PlacementProbeLite>> | null;
  state: TopicState;
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
    badgeAsset: string | null;
    /** 0048 — live, but still missing narration/illustrations. Drives the catalog's "still being built" notice. */
    inProgress: boolean;
    progress: ProgressShape;
    /** True until this user has a completed course_placements row (0043) — gates the first lesson server-side (learn.ts's PLACEMENT_REQUIRED check). */
    placementRequired: boolean;
  };
  adventures: AdventureNode[];
  nextLessonId: string | null;
}

const byPosition = <T extends { position: number }>(rows: T[]): T[] => [...rows].sort((a, b) => a.position - b.position);

/**
 * Assemble the full per-user tree for ONE course from its already-fetched
 * descendant rows (any order — sorted here).
 *
 * `placementCreditedLessonIds` (0043) defaults to empty and `hasCompletedPlacement`
 * defaults to true — existing callers that don't pass them (tests, and any
 * future course that never needs placement) get exactly today's behavior:
 * no credits folded in, never gated. `routes/learn.ts` is the one real
 * caller that passes both explicitly, fetched fresh from placement_credits/
 * course_placements each time (never cached — a credit granted mid-session
 * must show up on the very next tree read).
 */
export function assembleCourseTree(
  course: CourseRowLite,
  adventureRows: AdventureRowLite[],
  sagaRows: SagaRowLite[],
  topicRows: TopicRowLite[],
  lessonRows: LessonRowLite[],
  progressRows: ProgressRowLite[],
  placementCreditedLessonIds: ReadonlySet<string> = new Set(),
  hasCompletedPlacement = true,
): CourseTree {
  const sagasByAdventure = new Map<string, SagaRowLite[]>();
  for (const s of sagaRows) sagasByAdventure.set(s.adventure_id, [...(sagasByAdventure.get(s.adventure_id) ?? []), s]);

  const topicsBySaga = new Map<string, TopicRowLite[]>();
  for (const t of topicRows) topicsBySaga.set(t.saga_id, [...(topicsBySaga.get(t.saga_id) ?? []), t]);

  const lessonsByTopic = new Map<string, LessonRowLite[]>();
  for (const l of lessonRows) lessonsByTopic.set(l.topic_id, [...(lessonsByTopic.get(l.topic_id) ?? []), l]);

  const bestScoreByLesson = new Map(progressRows.map((p) => [p.lesson_id, p.best_score]));
  const passedLessonIds = new Set(progressRows.filter((p) => p.passed).map((p) => p.lesson_id));
  // Credited lessons count as passed for EVERY downstream computation — unlock
  // math, progress bars, badge-eligible completion (product decision: a
  // placement quiz result is real evidence of mastery, never re-demanded).
  // Real vs. credited stays distinguishable via LessonNode.placementCredited.
  const effectivePassedLessonIds = new Set([...passedLessonIds, ...placementCreditedLessonIds]);

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

  const { states: lessonStates, currentLessonId } = computeLessonStates(flatLessons, effectivePassedLessonIds);

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
          placementCredited: placementCreditedLessonIds.has(lesson.id),
        }));
        const passedCount = lessons.filter((l) => l.state === 'passed').length;
        const state: TopicState =
          lessons.length > 0 && passedCount === lessons.length ? 'completed' : passedCount > 0 ? 'in-progress' : 'not-started';
        return {
          id: topic.id,
          slug: topic.slug,
          title: topic.title,
          position: topic.position,
          kind: topic.kind ?? 'teaching',
          reviewOf: topic.review_of ?? [],
          prerequisites: topic.prerequisites ?? [],
          placementProbe: topic.placement_probe ?? null,
          state,
          lessons,
        };
      });
      const sagaLessonIds = topics.flatMap((t) => t.lessons.map((l) => l.id));
      return {
        id: saga.id,
        slug: saga.slug,
        title: saga.title,
        icon: saga.icon,
        position: saga.position,
        progress: progressOf(sagaLessonIds, effectivePassedLessonIds),
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
      state: computeAdventureState(ownLessonIds, previousLessonIds, effectivePassedLessonIds),
      progress: progressOf(ownLessonIds, effectivePassedLessonIds),
      sagas,
    };
  });

  // ---- review-due pass (territory map, 0016) --------------------------------
  // A COMPLETED topic flips to 'review-due' while a review topic that cites it
  // still has unpassed lessons: the map tells the kid "this territory needs a
  // revisit" from the spaced-review layer itself, not from a heuristic.
  // review_of paths are "adv/saga" (every topic of the saga) or
  // "adv/saga/topic", resolved against the assembled slugs.
  const topicByPath = new Map<string, TopicNode>();
  const topicsBySagaPath = new Map<string, TopicNode[]>();
  for (const adventure of adventures) {
    for (const saga of adventure.sagas) {
      const sagaPath = `${adventure.slug}/${saga.slug}`;
      topicsBySagaPath.set(sagaPath, saga.topics);
      for (const topic of saga.topics) topicByPath.set(`${sagaPath}/${topic.slug}`, topic);
    }
  }
  for (const adventure of adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        if (topic.kind === 'teaching' || topic.state === 'completed' || topic.reviewOf.length === 0) continue;
        for (const path of topic.reviewOf) {
          const cited = topicByPath.get(path) ?? null;
          const citedList = cited ? [cited] : (topicsBySagaPath.get(path) ?? []);
          for (const c of citedList) {
            if (c.state === 'completed') c.state = 'review-due';
          }
        }
      }
    }
  }

  return {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      subject: course.subject,
      badgeAsset: course.badge_asset ?? null,
      inProgress: course.in_progress ?? false,
      progress: progressOf(
        flatLessons.map((l) => l.id),
        effectivePassedLessonIds,
      ),
      placementRequired: !hasCompletedPlacement,
    },
    adventures,
    nextLessonId: currentLessonId,
  };
}

/**
 * Flattens an already-assembled tree's topics into the global course order
 * placementAlgorithm.ts needs (0043) — REUSES the tree's own already-correct
 * nested order (adventures/sagas/topics are all `byPosition`-sorted by
 * assembleCourseTree already) instead of re-deriving it, so placement and
 * unlock can never drift onto two different orderings. Call this with a
 * tree assembled with an EMPTY placementCreditedLessonIds set (no credits
 * exist yet at the moment a NEW placement is being computed) — a tree
 * assembled for ordinary display already reflects whatever credits exist.
 *
 * Review-kind topics are DELIBERATELY included, not filtered out: they never
 * carry a placement probe (`hasProbe: false`), so they naturally stop the
 * quiz method's contiguous-correct-prefix walk. That is the intended
 * behavior, not a gap to patch around — a learner placed past a saga's
 * teaching topics lands AT that saga's review checkpoint, the same
 * spaced-review consolidation any non-placed learner would also hit next,
 * rather than skipping practice on material a quiz (not full lesson play)
 * verified.
 */
export function flattenTopicsForPlacement(tree: CourseTree): PlacementTopic[] {
  const all: PlacementTopic[] = [];
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        all.push({
          id: topic.id,
          path: `${adventure.slug}/${saga.slug}/${topic.slug}`,
          hasProbe: topic.placementProbe !== null,
          prerequisites: topic.prerequisites.map((p) => ({ path: p.path, strength: p.strength })),
          lessonIds: topic.lessons.map((l) => l.id),
        });
      }
    }
  }

  /*
   * Placement walks topics a learner can actually PLAY. RLS already hides
   * archived lessons, so a topic whose lessons were all archived arrives with
   * an empty lesson list — 68 of financial-education's 327 topics, after the
   * quality prune took that catalog from 1,208 lessons to 475. Leaving them in
   * would let the frontier land on a topic with nothing in it and would inflate
   * every "you skipped N lessons" count with lessons that do not exist.
   */
  const playable = all.filter((t) => t.lessonIds.length > 0);
  const playablePaths = new Set(playable.map((t) => t.path));
  const playableSagaPaths = new Set(playable.map((t) => t.path.split('/').slice(0, 2).join('/')));

  /*
   * AND THEN THE EDGES HAVE TO FOLLOW THE FILTER.
   *
   * Dropping a topic from the walk without dropping the edges that POINT AT it
   * leaves a requirement nobody can ever meet — and the hard-prerequisite cap
   * reads an unmet edge as "stop crediting here", permanently, for everyone.
   * Measured against production before this existed: seven of
   * financial-education's 43 edges pointed at topics the prune had archived,
   * two of them `hard`, and the earliest capped EVERY learner at topic 144 of
   * 259 however much they knew — a silent 55% ceiling on the published course,
   * produced by filtering one half of a pair. That is the same shape as the
   * defect this placement rewrite exists to fix.
   *
   * Dropping the edge is safe HERE specifically because `graph:check` validates
   * every path against the FULL catalog at authoring time
   * (`competency-reference`), so a target missing at runtime can only mean the
   * content was archived — a legitimate lifecycle state, not a typo. Gating on
   * material no learner can reach is gating on nothing.
   */
  return playable.map((topic) => ({
    ...topic,
    prerequisites: topic.prerequisites.filter((p) => playablePaths.has(p.path) || playableSagaPaths.has(p.path)),
  }));
}

export interface PlacementProbeForClient {
  topicId: string;
  prompt: string;
  options: string[];
}

/**
 * ONE locale-picked, ANSWER-STRIPPED probe, by topic id — the adaptive quiz
 * asks for exactly the topic its search chose, so this replaced the old
 * "first N probes in course order" lister along with the prefix walk that
 * consumed it. correctIndex is never exposed, the same sanctity stripAnswers()
 * gives lesson content. Falls back es-MX (authoring locale) -> any available
 * locale, mirroring pickLessonLocale's posture.
 */
export function placementProbeForTopic(
  tree: CourseTree,
  topicId: string,
  locale: 'en-US' | 'es-MX' | 'pt-BR',
): PlacementProbeForClient | null {
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        if (topic.id !== topicId) continue;
        const bundle = topic.placementProbe;
        if (!bundle) return null;
        const probe = bundle[locale] ?? bundle['es-MX'] ?? Object.values(bundle)[0];
        return probe ? { topicId: topic.id, prompt: probe.prompt, options: probe.options } : null;
      }
    }
  }
  return null;
}

/**
 * The course at ADVENTURE granularity, in order — the coarse outline the
 * conversational intake sends to the model. Deliberately not the topic list: a
 * model that can see 216 topic titles can be talked into naming one, and the
 * intake is only ever allowed to produce a rough position.
 */
export function courseOutline(tree: CourseTree, locale: 'en-US' | 'es-MX' | 'pt-BR'): string[] {
  return tree.adventures
    .map((adventure) => {
      const title = adventure.title as Record<string, string> | null;
      return title?.[locale] ?? title?.['es-MX'] ?? Object.values(title ?? {})[0] ?? adventure.slug;
    })
    .filter((title): title is string => typeof title === 'string' && title.length > 0);
}

export interface PlacementProbeForGrading {
  topicId: string;
  correctIndex: number;
}

/** Every probed topic's correctIndex, server-side only — never sent to the client (grading input for POST /placement/:slug/complete). */
export function listPlacementProbesForGrading(tree: CourseTree, locale: 'en-US' | 'es-MX' | 'pt-BR'): PlacementProbeForGrading[] {
  const out: PlacementProbeForGrading[] = [];
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        const bundle = topic.placementProbe;
        if (!bundle) continue;
        const probe = bundle[locale] ?? bundle['es-MX'] ?? Object.values(bundle)[0];
        if (!probe) continue;
        out.push({ topicId: topic.id, correctIndex: probe.correctIndex });
      }
    }
  }
  return out;
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: Json;
  subject: string;
  badgeAsset: string | null;
  inProgress: boolean;
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
    badgeAsset: course.badge_asset ?? null,
    inProgress: course.in_progress ?? false,
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
