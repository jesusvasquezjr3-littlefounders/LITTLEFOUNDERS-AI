/*
 * Adaptive placement over the course's competency graph.
 *
 * WHAT CHANGED AND WHY. The first version walked the topic list from the
 * front, administering up to 6 pre-authored probes, and credited "the longest
 * contiguous correct-and-probed prefix". Over a 216-topic course that put a
 * hard ceiling of 6 topics — 2.8% — on how far ANY learner could ever be
 * placed, so an adult who answered every question correctly still landed at
 * topic 7. It also read `claimedLevel` and ignored `educationLevel` entirely.
 * In production it never even got that far: with zero authored probes it took
 * its `no_probe_content_fallback` branch for 5 of the 6 real placements, two
 * of them adults who had declared themselves "confident", and issued exactly
 * zero skip-ahead credits in its lifetime.
 *
 * THE MODEL. A learner is represented by ONE number: the frontier `k`, meaning
 * "knows the first k topics of the ordered teaching path, does not yet know
 * the rest". Placement is the search for k, by binary search over the topic
 * order, which reaches any of 216 topics in ~8 questions instead of 6 topics
 * in 6. Evidence is strictly bounded:
 *
 *     lo = 1 + the HIGHEST index answered correctly   (they know that topic)
 *     hi =     the LOWEST index answered incorrectly  (they do not know it)
 *     k  = min(lo, hi)
 *
 * Taking the MIN is what makes a non-monotonic learner safe: someone who gets
 * a late question right by luck and an early one wrong is placed at the early
 * one. Evidence of NOT knowing always outranks evidence of knowing.
 *
 * SIGNALS ARE PRIORS, NEVER VERDICTS. Age, education level, claimed level and
 * the optional AI intake decide exactly one thing: WHERE THE FIRST QUESTION IS
 * ASKED. That is a smaller lever than it sounds and a more important one — it
 * is the difference between opening a confident 35-year-old on "what is a
 * coin?" and opening them on something worth their time, which is the specific
 * insult the testers reported. It does NOT meaningfully shorten the quiz
 * (binary search still has to bracket the frontier from one side), and it
 * never enters `k`. For a learner whose answers are
 * consistent with a single frontier, the placement is bit-identical whatever
 * the signals said — asserted in placementAlgorithm.test.ts, because "we place
 * by knowledge, not by age" is the product promise this file has to keep.
 *
 * CREDIT IS INFERRED FROM A SAMPLED WALK, and that is a deliberate product
 * decision, not an oversight: verifying all 216 topics individually is the
 * thing that made the old version useless. Three controls bound it — a
 * confirmation question below the converged frontier catches a lucky guess;
 * the hard-prerequisite cap refuses to credit past an unmet edge; and credits
 * live in their own table, so a placement credit never masquerades as a lesson
 * the learner actually played.
 *
 * Dependency-free and side-effect-free on purpose (no PostgREST, no fetch), so
 * every decision above is unit-testable with plain fixtures.
 */

export type ClaimedLevel = 'new' | 'some' | 'confident';
export type EducationLevel = 'preschool' | 'elementary' | 'middle' | 'high' | 'adult';
export type PlacementMethod =
  | 'adaptive_quiz'
  | 'learner_chose_start'
  | 'learner_adjusted'
  | 'no_probe_content_fallback';

export interface PlacementPrerequisite {
  /** "<adventure>/<saga>" or "<adventure>/<saga>/<topic>" — same grammar as topics.review_of. */
  path: string;
  strength: 'hard' | 'soft';
}

export interface PlacementTopic {
  id: string;
  /** "<adventure>/<saga>/<topic>" — this topic's own path, for resolving OTHER topics' prerequisites. */
  path: string;
  hasProbe: boolean;
  prerequisites: readonly PlacementPrerequisite[];
  /** This topic's live lesson ids, already in position order. */
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

/**
 * Everything known about the learner BEFORE the first question. Every field is
 * optional and every field is advisory — see the header. `aiPriorFraction` is
 * the one signal an LLM produces (0 = knows nothing, 1 = knows the whole
 * course); it is clamped and averaged with the rest exactly like the others,
 * so a hallucinating model can move the first question and nothing else.
 */
export interface PlacementSignals {
  claimedLevel?: ClaimedLevel;
  educationLevel?: EducationLevel;
  ageYears?: number;
  aiPriorFraction?: number;
}

/** How many probes a learner may be asked before the search stops and commits. */
export const MAX_QUESTIONS = 10;
/** Questions reserved, after convergence, to catch a lucky guess below the frontier. */
export const CONFIRMATION_QUESTIONS = 2;

export interface AskStep {
  kind: 'ask';
  topicId: string;
  /** Index into the ordered teaching path — diagnostics and progress, not shown raw. */
  topicIndex: number;
  /** 1-based, for "question 3 of ~10". */
  questionNumber: number;
  /** Upper bound on how many more questions remain, for an honest progress bar. */
  questionsRemaining: number;
  phase: 'search' | 'confirm';
}

export interface DoneStep {
  kind: 'done';
  frontier: number;
  startTopicId: string | null;
  startLessonId: string | null;
  creditedLessonIds: readonly string[];
  creditedTopicCount: number;
  method: PlacementMethod;
  /** True when an unmet hard prerequisite pulled the frontier back below the evidence. */
  cappedByPrerequisite: boolean;
}

export type PlacementStep = AskStep | DoneStep;

/**
 * Grades submitted answers against each topic's persisted probe. An answer for
 * a topic with no matching probe is DROPPED rather than trusted — grading is
 * server-authoritative here, the same posture as POST /learn/lessons/:id/grade.
 * Order is preserved: the search replays answers in the order they were given.
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

/** Satisfied by an exact topic-path match, or (saga-level path) every topic of that saga being credited. */
function isPrerequisiteSatisfied(
  prereqPath: string,
  creditedPaths: ReadonlySet<string>,
  topicPathsBySagaPath: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (creditedPaths.has(prereqPath)) return true;
  const sagaTopics = topicPathsBySagaPath.get(prereqPath);
  return sagaTopics !== undefined && sagaTopics.length > 0 && sagaTopics.every((p) => creditedPaths.has(p));
}

const CLAIMED_PRIOR: Record<ClaimedLevel, number> = { new: 0.03, some: 0.3, confident: 0.6 };
const EDUCATION_PRIOR: Record<EducationLevel, number> = {
  preschool: 0.02,
  elementary: 0.12,
  middle: 0.35,
  high: 0.55,
  adult: 0.6,
};

function agePrior(ageYears: number): number {
  if (ageYears < 8) return 0.05;
  if (ageYears < 12) return 0.2;
  if (ageYears < 15) return 0.4;
  if (ageYears < 18) return 0.55;
  return 0.6;
}

/**
 * Where to aim the FIRST question, as a fraction of the teaching path.
 *
 * Deliberately never returns 1.0: opening at the very last topic wastes the
 * question on the least likely answer. Every prior tops out at 0.6, so the
 * first question is a probe the learner has a real chance of both passing and
 * failing — which is exactly the question that carries the most information.
 */
export function seedFraction(signals: PlacementSignals): number {
  const priors: number[] = [];
  if (signals.claimedLevel) priors.push(CLAIMED_PRIOR[signals.claimedLevel]);
  if (signals.educationLevel) priors.push(EDUCATION_PRIOR[signals.educationLevel]);
  if (signals.ageYears !== undefined && Number.isFinite(signals.ageYears)) priors.push(agePrior(signals.ageYears));
  if (signals.aiPriorFraction !== undefined && Number.isFinite(signals.aiPriorFraction)) {
    priors.push(Math.min(1, Math.max(0, signals.aiPriorFraction)));
  }
  if (priors.length === 0) return 0.3;
  return priors.reduce((a, b) => a + b, 0) / priors.length;
}

/**
 * The probed topic nearest `target` inside `[lo, hi)`, or null if that window
 * holds none. Ties break UPWARD (toward the harder topic) so a course with
 * sparse probes still climbs instead of stalling on the same low question.
 */
function nearestProbed(topics: readonly PlacementTopic[], target: number, lo: number, hi: number, asked: ReadonlySet<number>): number | null {
  const clamped = Math.min(Math.max(target, lo), hi - 1);
  for (let radius = 0; radius <= hi - lo; radius++) {
    const up = clamped + radius;
    if (up < hi && topics[up]!.hasProbe && !asked.has(up)) return up;
    const down = clamped - radius;
    if (down >= lo && topics[down]!.hasProbe && !asked.has(down)) return down;
  }
  return null;
}

interface SearchState {
  lo: number;
  hi: number;
  asked: Set<number>;
  answeredCount: number;
}

/**
 * Replays the graded answers against the ordered path to recover the search
 * state. Stateless by design: the server keeps no session, so a refresh, a
 * dropped connection or a resumed device all recompute the identical state
 * from the answer list, and the client can never claim credit for a question
 * it was not asked — an answer whose topic is not in this course is simply not
 * in `graded` (gradeQuizAnswers dropped it), and one for an unprobed topic can
 * never be correct because there is no correct index to match.
 */
function replay(topics: readonly PlacementTopic[], graded: readonly GradedAnswer[]): SearchState {
  const indexById = new Map(topics.map((t, i) => [t.id, i]));
  const state: SearchState = { lo: 0, hi: topics.length, asked: new Set(), answeredCount: 0 };
  let highestCorrect = -1;
  let lowestWrong = topics.length;

  for (const answer of graded) {
    const index = indexById.get(answer.topicId);
    if (index === undefined) continue;
    state.asked.add(index);
    state.answeredCount++;
    if (answer.correct) highestCorrect = Math.max(highestCorrect, index);
    else lowestWrong = Math.min(lowestWrong, index);
  }
  state.lo = highestCorrect + 1;
  state.hi = lowestWrong;
  return state;
}

/**
 * The next thing to do: ask a probe, or commit a placement.
 *
 * `graded` is the full answer history in order. Call with `[]` to get the first
 * question; call again with each answer appended. Pure — the same inputs always
 * produce the same step.
 */
export function nextPlacementStep(
  topics: readonly PlacementTopic[],
  signals: PlacementSignals,
  graded: readonly GradedAnswer[],
): PlacementStep {
  if (topics.length === 0) return commit(topics, 0, 'no_probe_content_fallback');
  if (!topics.some((t) => t.hasProbe)) return commit(topics, 0, 'no_probe_content_fallback');

  const state = replay(topics, graded);
  const frontier = Math.min(state.lo, state.hi);

  if (state.answeredCount >= MAX_QUESTIONS) return commit(topics, frontier, 'adaptive_quiz');

  // ---- search phase: narrow [lo, hi) ----
  if (state.lo < state.hi) {
    const target =
      state.answeredCount === 0
        ? Math.floor(seedFraction(signals) * topics.length)
        : Math.floor((state.lo + state.hi) / 2);
    const index = nearestProbed(topics, target, state.lo, state.hi, state.asked);
    if (index !== null) return ask(topics, index, state.answeredCount, 'search');
    // No unasked probe left inside the bracket: the evidence is as good as this
    // course's probe coverage allows. Committing beats asking a repeat question.
    return commit(topics, frontier, 'adaptive_quiz');
  }

  // ---- confirmation phase: guard the frontier against a lucky guess ----
  const confirmationsUsed = countConfirmations(topics, graded);
  if (frontier >= 2 && confirmationsUsed < CONFIRMATION_QUESTIONS) {
    const target = Math.floor(frontier * (confirmationsUsed === 0 ? 0.5 : 0.8));
    const index = nearestProbed(topics, target, 0, frontier, state.asked);
    if (index !== null) return ask(topics, index, state.answeredCount, 'confirm');
  }
  return commit(topics, frontier, 'adaptive_quiz');
}

/**
 * How many questions were asked AFTER the search converged — the confirmations.
 *
 * Counted by replaying the answers one at a time and finding the first prefix
 * at which `lo >= hi`; everything after that prefix is a confirmation. The
 * obvious shortcut — "questions that landed below the frontier" — is wrong, and
 * wrong in a way that silently disables the whole confirmation phase: a binary
 * search descends by asking above and below the frontier alternately, so most
 * searches already contain two such questions and the guard would conclude its
 * confirmations were spent before it asked a single one.
 */
function countConfirmations(topics: readonly PlacementTopic[], graded: readonly GradedAnswer[]): number {
  const indexById = new Map(topics.map((t, i) => [t.id, i]));
  let highestCorrect = -1;
  let lowestWrong = topics.length;
  let consumed = 0;

  for (const answer of graded) {
    const index = indexById.get(answer.topicId);
    if (index === undefined) continue;
    if (highestCorrect + 1 >= lowestWrong) break; // already converged before this answer
    if (answer.correct) highestCorrect = Math.max(highestCorrect, index);
    else lowestWrong = Math.min(lowestWrong, index);
    consumed++;
  }
  const answeredInCourse = graded.filter((a) => indexById.has(a.topicId)).length;
  return answeredInCourse - consumed;
}

function ask(topics: readonly PlacementTopic[], index: number, answeredCount: number, phase: 'search' | 'confirm'): AskStep {
  // An honest bound, not a guess: binary search needs at most log2(window)
  // more questions, plus the confirmations, and never more than the budget.
  const searchBudget = Math.ceil(Math.log2(Math.max(topics.length, 2)));
  const remaining = Math.max(0, Math.min(MAX_QUESTIONS, searchBudget + CONFIRMATION_QUESTIONS) - answeredCount - 1);
  return {
    kind: 'ask',
    topicId: topics[index]!.id,
    topicIndex: index,
    questionNumber: answeredCount + 1,
    questionsRemaining: remaining,
    phase,
  };
}

/**
 * Turns a frontier into a placement, applying the hard-prerequisite cap: the
 * first credited topic whose own hard edge is not satisfied by everything
 * credited strictly before it excludes itself and everything after.
 */
function commit(topics: readonly PlacementTopic[], frontier: number, method: PlacementMethod): DoneStep {
  if (topics.length === 0) {
    return {
      kind: 'done',
      frontier: 0,
      startTopicId: null,
      startLessonId: null,
      creditedLessonIds: [],
      creditedTopicCount: 0,
      method,
      cappedByPrerequisite: false,
    };
  }

  const bounded = Math.min(Math.max(frontier, 0), topics.length);

  // Built by mutating one accumulator rather than rebuilding per topic: this
  // walks the FULL course topic list, so an O(n²) rebuild scales with course size.
  const topicPathsBySagaPath = new Map<string, string[]>();
  for (const t of topics) {
    const sagaPath = sagaPathOf(t.path);
    const existing = topicPathsBySagaPath.get(sagaPath);
    if (existing) existing.push(t.path);
    else topicPathsBySagaPath.set(sagaPath, [t.path]);
  }

  let cappedEnd = bounded;
  let cappedByPrerequisite = false;
  const priorPaths = new Set<string>();
  for (let i = 0; i < bounded; i++) {
    const topic = topics[i]!;
    const hasUnmetHard = topic.prerequisites.some(
      (p) => p.strength === 'hard' && !isPrerequisiteSatisfied(p.path, priorPaths, topicPathsBySagaPath),
    );
    if (hasUnmetHard) {
      cappedEnd = i;
      cappedByPrerequisite = true;
      break;
    }
    priorPaths.add(topic.path);
  }

  const creditedTopics = topics.slice(0, cappedEnd);

  /*
   * The learner has to land on a LESSON, not merely on a topic. A topic can
   * legitimately carry zero lessons here — RLS hides archived ones, and
   * financial-education alone has 733 archived lessons, so 26 of its topics
   * are empty shells from a learner's point of view. Landing on one produced a
   * null startLessonId and dropped the learner on the course page instead of
   * into the lesson their whole placement had just been computed for.
   */
  let startIndex = cappedEnd;
  while (startIndex < topics.length && topics[startIndex]!.lessonIds.length === 0) startIndex++;
  const startTopic = topics[startIndex] ?? null;

  return {
    kind: 'done',
    frontier: cappedEnd,
    startTopicId: startTopic?.id ?? null,
    startLessonId: startTopic?.lessonIds[0] ?? null,
    creditedLessonIds: creditedTopics.flatMap((t) => t.lessonIds),
    creditedTopicCount: creditedTopics.length,
    method,
    cappedByPrerequisite,
  };
}

/**
 * Commits a placement at an explicit frontier the LEARNER chose, rather than
 * one the quiz derived — "start me at the beginning" before the quiz, or the
 * nudge on the result screen when we placed them somewhere that does not match
 * how they actually feel. The prerequisite cap still applies: a learner may
 * move themselves DOWN freely, and up only as far as the graph allows.
 *
 * This exists because the reported complaint was never "the quiz asked bad
 * questions" — it was "I ended up somewhere that was not mine". A placement the
 * learner cannot argue with is a placement they have to abandon the product to
 * escape.
 */
export function placeAtLearnerChoice(topics: readonly PlacementTopic[], frontier: number, method: PlacementMethod): DoneStep {
  return commit(topics, frontier, method);
}
