/*
 * Pure placement computation — COURSE_ENGINE.md §3.2: "a placement quiz
 * walks the hard-edge DAG backwards from the learner's claimed level... and
 * drops the learner at the earliest unmet hard edge." Core is the SINGLE
 * SOURCE OF TRUTH for this, exactly like unlockRules.ts is for lesson
 * unlocking — the client never re-derives it, and the live quiz is 100%
 * deterministic (only the probe CONTENT was ever touched by an LLM, once
 * per catalog topic at generation time, never per learner: coursegen/src/
 * pipeline/placementProbe.ts).
 *
 * Kept dependency-free and side-effect-free on purpose (no PostgREST/fetch
 * here) so it is unit-testable with plain fixtures — see
 * src/__tests__/placementAlgorithm.test.ts.
 */

export type ClaimedLevel = 'new' | 'some' | 'confident';
export type PlacementMethod = 'quiz' | 'claimed_beginner_shortcut' | 'no_probe_content_fallback';

export interface PlacementPrerequisite {
  /** "<adventure-slug>/<saga-slug>" or "<adventure-slug>/<saga-slug>/<topic-slug>" — same grammar as topics.review_of. */
  path: string;
  strength: 'hard' | 'soft';
}

export interface PlacementTopic {
  id: string;
  /** "<adventure-slug>/<saga-slug>/<topic-slug>" — this topic's own path, for resolving OTHER topics' prerequisites against it. */
  path: string;
  hasProbe: boolean;
  prerequisites: readonly PlacementPrerequisite[];
  /** This topic's lesson ids, already in position order. */
  lessonIds: readonly string[];
}

export interface SubmittedAnswer {
  topicId: string;
  selectedIndex: number;
}

export interface ProbeForGrading {
  topicId: string;
  correctIndex: number;
}

export interface GradedAnswer {
  topicId: string;
  correct: boolean;
}

export interface PlacementResult {
  startTopicId: string | null;
  startLessonId: string | null;
  creditedLessonIds: readonly string[];
  method: PlacementMethod;
}

/**
 * Grades submitted answers against each topic's persisted probe. An answer
 * for a topic with no matching probe is dropped (stale/tampered client
 * state) rather than trusted — grading is always server-authoritative here,
 * the same posture as POST /learn/lessons/:id/grade.
 */
export function gradeQuizAnswers(probes: readonly ProbeForGrading[], answers: readonly SubmittedAnswer[]): GradedAnswer[] {
  const correctIndexByTopic = new Map(probes.map((p) => [p.topicId, p.correctIndex]));
  return answers
    .filter((a) => correctIndexByTopic.has(a.topicId))
    .map((a) => ({ topicId: a.topicId, correct: correctIndexByTopic.get(a.topicId) === a.selectedIndex }));
}

function sagaPathOf(topicPath: string): string {
  const parts = topicPath.split('/');
  return `${parts[0]}/${parts[1]}`;
}

/** A prerequisite path is satisfied by an exact topic-path match, or (saga-level path) every topic of that saga being in the credited set. */
function isPrerequisiteSatisfied(
  prereqPath: string,
  creditedPaths: ReadonlySet<string>,
  topicPathsBySagaPath: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (creditedPaths.has(prereqPath)) return true;
  const sagaTopics = topicPathsBySagaPath.get(prereqPath);
  return sagaTopics !== undefined && sagaTopics.length > 0 && sagaTopics.every((p) => creditedPaths.has(p));
}

/**
 * `flatTopics` MUST already be sorted by the global (adventure, saga, topic)
 * position tuple — the same order courseTree.ts's flattenTopicsForPlacement
 * derives from an already-assembled CourseTree, so placement and unlock
 * consume exactly one definition of "order".
 *
 * Contract (COURSE_ENGINE.md §3.2):
 * 1. claimed_beginner_shortcut — `claimedLevel==='new'` skips the quiz
 *    entirely (fewer clicks), starts at lesson 1, credits nothing.
 *    Self-report alone never skips content by itself.
 * 2. no_probe_content_fallback — the course has zero probed topics; same
 *    start-at-lesson-1 result, tagged distinctly so the course_placements
 *    row still exists and the gate never re-blocks.
 * 3. quiz — the longest CONTIGUOUS prefix of topics from the start that are
 *    each probed AND answered correctly (an unprobed OR wrong OR simply
 *    unasked topic stops the prefix — never skip past unverified content),
 *    then capped at the earliest topic whose own hard prerequisite is not
 *    satisfied by everything strictly before it.
 */
export function computePlacement(
  flatTopics: readonly PlacementTopic[],
  claimedLevel: ClaimedLevel,
  gradedAnswers: readonly GradedAnswer[],
): PlacementResult {
  if (flatTopics.length === 0) {
    return { startTopicId: null, startLessonId: null, creditedLessonIds: [], method: 'claimed_beginner_shortcut' };
  }

  if (claimedLevel === 'new') {
    const first = flatTopics[0]!;
    return { startTopicId: first.id, startLessonId: first.lessonIds[0] ?? null, creditedLessonIds: [], method: 'claimed_beginner_shortcut' };
  }

  if (!flatTopics.some((t) => t.hasProbe)) {
    const first = flatTopics[0]!;
    return { startTopicId: first.id, startLessonId: first.lessonIds[0] ?? null, creditedLessonIds: [], method: 'no_probe_content_fallback' };
  }

  const correctByTopic = new Map(gradedAnswers.map((a) => [a.topicId, a.correct]));

  // Longest contiguous correct-and-probed prefix from the start.
  let prefixEnd = 0;
  for (const topic of flatTopics) {
    if (topic.hasProbe && correctByTopic.get(topic.id) === true) prefixEnd += 1;
    else break;
  }

  // Hard-prerequisite cap: the first topic within that prefix whose own hard
  // edge isn't satisfied by everything strictly before it excludes itself
  // and everything after from the credited set.
  const topicPathsBySagaPath = new Map<string, string[]>();
  for (const t of flatTopics) {
    const sagaPath = sagaPathOf(t.path);
    topicPathsBySagaPath.set(sagaPath, [...(topicPathsBySagaPath.get(sagaPath) ?? []), t.path]);
  }

  let cappedEnd = prefixEnd;
  for (let i = 0; i < prefixEnd; i++) {
    const topic = flatTopics[i]!;
    const priorPaths = new Set(flatTopics.slice(0, i).map((t) => t.path));
    const hasUnmetHard = topic.prerequisites.some(
      (p) => p.strength === 'hard' && !isPrerequisiteSatisfied(p.path, priorPaths, topicPathsBySagaPath),
    );
    if (hasUnmetHard) {
      cappedEnd = i;
      break;
    }
  }

  const creditedTopics = flatTopics.slice(0, cappedEnd);
  const creditedLessonIds = creditedTopics.flatMap((t) => t.lessonIds);
  const startTopic = flatTopics[cappedEnd] ?? null;

  return {
    startTopicId: startTopic?.id ?? null,
    startLessonId: startTopic?.lessonIds[0] ?? null,
    creditedLessonIds,
    method: 'quiz',
  };
}
