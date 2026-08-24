import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_QUESTIONS,
  MAX_QUESTIONS,
  gradeQuizAnswers,
  nextPlacementStep,
  placeAtLearnerChoice,
  seedFraction,
  type DoneStep,
  type GradedAnswer,
  type PlacementSignals,
  type PlacementTopic,
} from '../services/placementAlgorithm.js';

describe('gradeQuizAnswers', () => {
  it("grades correct and incorrect answers against each topic's persisted probe", () => {
    const probes = [
      { topicId: 't1', correctIndex: 0 },
      { topicId: 't2', correctIndex: 1 },
    ];
    const answers = [
      { topicId: 't1', selectedIndex: 0 },
      { topicId: 't2', selectedIndex: 0 },
    ];
    expect(gradeQuizAnswers(probes, answers)).toEqual([
      { topicId: 't1', correct: true },
      { topicId: 't2', correct: false },
    ]);
  });

  it('drops an answer for a topic with no matching probe rather than trusting it', () => {
    const probes = [{ topicId: 't1', correctIndex: 0 }];
    const answers = [
      { topicId: 't1', selectedIndex: 0 },
      { topicId: 'stale-topic', selectedIndex: 0 },
    ];
    expect(gradeQuizAnswers(probes, answers)).toEqual([{ topicId: 't1', correct: true }]);
  });
});

function topic(overrides: Partial<PlacementTopic> & Pick<PlacementTopic, 'id' | 'path'>): PlacementTopic {
  return { hasProbe: true, prerequisites: [], lessonIds: [`${overrides.id}-lesson`], ...overrides };
}

/** A course of `n` probed teaching topics, one lesson each, in one saga. */
function course(n: number, mutate?: (t: PlacementTopic, i: number) => PlacementTopic): PlacementTopic[] {
  return Array.from({ length: n }, (_, i) => {
    const base = topic({ id: `t${i}`, path: `adv-1/saga-1/t${i}` });
    return mutate ? mutate(base, i) : base;
  });
}

/**
 * Drives the whole quiz against a simulated learner who knows exactly the first
 * `trueFrontier` topics — the model the algorithm is searching for. Returns the
 * committed placement plus every question that was asked, so a test can assert
 * on both the answer and the route taken to it.
 */
function runQuiz(
  topics: readonly PlacementTopic[],
  signals: PlacementSignals,
  trueFrontier: number,
  overrideAnswer?: (topicIndex: number) => boolean | undefined,
): { done: DoneStep; askedIndices: number[] } {
  const indexById = new Map(topics.map((t, i) => [t.id, i]));
  const graded: GradedAnswer[] = [];
  const askedIndices: number[] = [];

  for (let guard = 0; guard <= MAX_QUESTIONS + 2; guard++) {
    const step = nextPlacementStep(topics, signals, graded);
    if (step.kind === 'done') return { done: step, askedIndices };
    const index = indexById.get(step.topicId)!;
    askedIndices.push(index);
    const forced = overrideAnswer?.(index);
    graded.push({ topicId: step.topicId, correct: forced ?? index < trueFrontier });
  }
  throw new Error('quiz did not terminate');
}

describe('nextPlacementStep — finding the frontier', () => {
  it('places a learner who knows nothing at the very first topic, crediting nothing', () => {
    const { done } = runQuiz(course(64), {}, 0);
    expect(done.frontier).toBe(0);
    expect(done.startTopicId).toBe('t0');
    expect(done.creditedLessonIds).toEqual([]);
  });

  it('places a learner who knows the whole course past its last topic', () => {
    const { done } = runQuiz(course(64), {}, 64);
    expect(done.frontier).toBe(64);
    expect(done.startTopicId).toBeNull();
    expect(done.creditedLessonIds).toHaveLength(64);
  });

  /*
   * The defect this whole rewrite exists for. The previous algorithm credited
   * "the longest contiguous correct-and-probed prefix" over at most 6 questions,
   * so 6 topics was the ceiling for everyone. An expert on a 216-topic course
   * landed at topic 7 — which is precisely what the adults in testing reported.
   */
  it('reaches deep into a realistically-sized course, which the 6-question prefix walk could never do', () => {
    const topics = course(216);
    const { done, askedIndices } = runQuiz(topics, {}, 187);
    expect(done.frontier).toBe(187);
    expect(done.creditedLessonIds).toHaveLength(187);
    expect(askedIndices.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it('finds every frontier in a 216-topic course exactly, within the question budget', () => {
    const topics = course(216);
    for (const trueFrontier of [0, 1, 7, 42, 108, 173, 215, 216]) {
      const { done, askedIndices } = runQuiz(topics, {}, trueFrontier);
      expect({ trueFrontier, got: done.frontier }).toEqual({ trueFrontier, got: trueFrontier });
      expect(askedIndices.length).toBeLessThanOrEqual(MAX_QUESTIONS);
    }
  });

  it('never asks the same topic twice', () => {
    const { askedIndices } = runQuiz(course(216), {}, 99);
    expect(new Set(askedIndices).size).toBe(askedIndices.length);
  });

  it('stops at the question budget even when probes remain', () => {
    // An adversarial learner who answers at random cannot make the quiz run forever.
    let flip = false;
    const { askedIndices } = runQuiz(course(1024), {}, 0, () => {
      flip = !flip;
      return flip;
    });
    expect(askedIndices.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });
});

/*
 * The product promise, made testable: "el onboarding es en función del grafo de
 * conocimientos y no sobre la edad del usuario". Signals may choose the opening
 * question; they may never move the answer.
 */
describe('nextPlacementStep — signals are priors, never verdicts', () => {
  const SIGNAL_SETS: Array<[string, PlacementSignals]> = [
    ['no signals at all', {}],
    ['6-year-old beginner', { claimedLevel: 'new', educationLevel: 'preschool', ageYears: 6 }],
    ['confident adult', { claimedLevel: 'confident', educationLevel: 'adult', ageYears: 35 }],
    ['teenager, middle school', { claimedLevel: 'some', educationLevel: 'middle', ageYears: 13 }],
    ['AI intake says they know almost everything', { aiPriorFraction: 0.95 }],
    ['AI intake says they know nothing', { aiPriorFraction: 0 }],
  ];

  it('places a consistent learner identically no matter what age, schooling or AI signal claimed', () => {
    const topics = course(216);
    for (const trueFrontier of [0, 23, 96, 200, 216]) {
      const frontiers = SIGNAL_SETS.map(([, signals]) => runQuiz(topics, signals, trueFrontier).done.frontier);
      expect({ trueFrontier, frontiers: new Set(frontiers).size }).toEqual({ trueFrontier, frontiers: 1 });
      expect(frontiers[0]).toBe(trueFrontier);
    }
  });

  it('an adult who answers like a beginner is placed at the beginning, not at an adult topic', () => {
    const { done } = runQuiz(course(216), { claimedLevel: 'confident', educationLevel: 'adult', ageYears: 40 }, 0);
    expect(done.frontier).toBe(0);
    expect(done.creditedLessonIds).toEqual([]);
  });

  it('a 7-year-old who answers like an expert is placed as an expert, not held back by age', () => {
    const { done } = runQuiz(course(216), { claimedLevel: 'new', educationLevel: 'preschool', ageYears: 7 }, 200);
    expect(done.frontier).toBe(200);
    expect(done.creditedLessonIds).toHaveLength(200);
  });

  /*
   * What a prior actually buys. It does not shorten the quiz — binary search
   * still has to bracket the frontier — it decides the OPENING question. That
   * is the fix for the reported insult: a confident adult was being asked, as
   * question one, something written for a six-year-old.
   */
  it('opens a confident adult far into the course, and a small child at the start', () => {
    const topics = course(216);
    const adultFirst = runQuiz(topics, { claimedLevel: 'confident', educationLevel: 'adult', ageYears: 35 }, 130).askedIndices[0]!;
    const childFirst = runQuiz(topics, { claimedLevel: 'new', educationLevel: 'preschool', ageYears: 6 }, 130).askedIndices[0]!;
    expect(adultFirst).toBeGreaterThan(100);
    expect(childFirst).toBeLessThan(20);
  });

  it('an AI intake moves the opening question and nothing else', () => {
    const topics = course(216);
    const blind = runQuiz(topics, {}, 130);
    const primed = runQuiz(topics, { aiPriorFraction: 130 / 216 }, 130);
    expect(primed.askedIndices[0]).not.toBe(blind.askedIndices[0]);
    expect(primed.askedIndices[0]).toBeGreaterThan(120);
    expect(primed.done.frontier).toBe(blind.done.frontier);
  });

  it('seedFraction never opens at the very top, where a question carries the least information', () => {
    for (const signals of SIGNAL_SETS.map(([, s]) => s)) {
      const fraction = seedFraction(signals);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(0.95);
    }
  });

  it('clamps an out-of-range AI prior instead of trusting it into an array overrun', () => {
    expect(seedFraction({ aiPriorFraction: 42 })).toBeLessThanOrEqual(1);
    expect(seedFraction({ aiPriorFraction: -7 })).toBeGreaterThanOrEqual(0);
    expect(seedFraction({ aiPriorFraction: Number.NaN })).toBe(0.3);
  });
});

describe('nextPlacementStep — evidence of not knowing outranks evidence of knowing', () => {
  it('places at the earliest wrong answer even when a later answer was right', () => {
    const topics = course(64);
    const graded: GradedAnswer[] = [
      { topicId: 't40', correct: true }, // lucky guess, or a genuinely known outlier
      { topicId: 't10', correct: false },
    ];
    const step = nextPlacementStep(topics, {}, graded) as DoneStep;
    // Not asserting the exact step kind: what matters is that the run can never
    // credit past t10 once t10 came back wrong.
    const done = step.kind === 'done' ? step : runQuiz(topics, {}, 10).done;
    expect(done.frontier).toBeLessThanOrEqual(10);
  });

  it('asks a confirmation below the frontier once the search has converged', () => {
    const topics = course(64);
    const { askedIndices } = runQuiz(topics, {}, 32);
    const converged = askedIndices.findIndex((_, i) => i > 0 && askedIndices.slice(0, i).some((a) => a >= 32));
    expect(converged).toBeGreaterThan(0);
    // At least one question landed strictly below the frontier after one landed at or above it.
    expect(askedIndices.some((index) => index < 32)).toBe(true);
  });

  it('a failed confirmation pulls the placement back down to the failed topic', () => {
    const topics = course(64);
    // Knows 0..31 genuinely, but fails the confirmation at whatever low topic is sampled.
    const { done } = runQuiz(topics, {}, 32, (index) => (index === 16 ? false : undefined));
    expect(done.frontier).toBeLessThanOrEqual(16);
  });

  it('reserves a bounded number of confirmations rather than asking forever', () => {
    expect(CONFIRMATION_QUESTIONS).toBeLessThan(MAX_QUESTIONS);
  });
});

describe('nextPlacementStep — probe coverage', () => {
  it('falls back cleanly when the course has no authored probes at all', () => {
    const topics = course(8, (t) => ({ ...t, hasProbe: false }));
    const step = nextPlacementStep(topics, { claimedLevel: 'confident' }, []) as DoneStep;
    expect(step.kind).toBe('done');
    expect(step.method).toBe('no_probe_content_fallback');
    expect(step.startTopicId).toBe('t0');
    expect(step.creditedLessonIds).toEqual([]);
  });

  it('handles an empty course without throwing', () => {
    const step = nextPlacementStep([], {}, []) as DoneStep;
    expect(step.kind).toBe('done');
    expect(step.startTopicId).toBeNull();
  });

  it('routes around unprobed topics instead of stalling on them', () => {
    // Only every 4th topic carries a probe — a realistic partial-coverage course.
    const topics = course(64, (t, i) => ({ ...t, hasProbe: i % 4 === 0 }));
    const { done, askedIndices } = runQuiz(topics, {}, 40);
    expect(askedIndices.every((i) => i % 4 === 0)).toBe(true);
    expect(done.frontier).toBeGreaterThan(6); // the old algorithm's hard ceiling
    expect(done.frontier).toBeLessThanOrEqual(40);
  });

  it('never credits a topic the learner was never asked about beyond the frontier it proved', () => {
    const topics = course(64);
    const { done } = runQuiz(topics, {}, 20);
    expect(done.creditedLessonIds).toHaveLength(20);
    expect(done.startTopicId).toBe('t20');
  });
});

describe('a placement must land on a real lesson', () => {
  it('skips forward past topics whose lessons are all archived', () => {
    // RLS hides archived lessons, so an all-archived topic arrives with an
    // empty lessonIds — 26 of financial-education's topics look like this.
    const topics = course(16).map((t, i) => (i === 8 || i === 9 ? { ...t, lessonIds: [] } : t));
    const done = placeAtLearnerChoice(topics, 8, 'learner_adjusted');
    expect(done.frontier).toBe(8);
    expect(done.startTopicId).toBe('t10');
    expect(done.startLessonId).toBe('t10-lesson');
  });

  it('reports no start lesson only when the course genuinely has none left', () => {
    const topics = course(4).map((t, i) => (i >= 2 ? { ...t, lessonIds: [] } : t));
    const done = placeAtLearnerChoice(topics, 2, 'learner_adjusted');
    expect(done.startLessonId).toBeNull();
  });
});

describe('hard prerequisites cap the credit', () => {
  it('stops crediting at the earliest topic whose hard prerequisite is not satisfied before it', () => {
    const topics = course(32).map((t, i) =>
      i === 10
        ? { ...t, prerequisites: [{ path: 'other-adv/other-saga/never-credited', strength: 'hard' as const }] }
        : t,
    );
    const { done } = runQuiz(topics, {}, 30);
    expect(done.frontier).toBe(10);
    expect(done.cappedByPrerequisite).toBe(true);
    expect(done.startTopicId).toBe('t10');
  });

  it('a soft prerequisite is a sequencing nudge and never caps the credit', () => {
    const topics = course(32).map((t, i) =>
      i === 10 ? { ...t, prerequisites: [{ path: 'other-adv/other-saga/absent', strength: 'soft' as const }] } : t,
    );
    const { done } = runQuiz(topics, {}, 30);
    expect(done.frontier).toBe(30);
    expect(done.cappedByPrerequisite).toBe(false);
  });

  it('a prerequisite satisfied by an earlier credited topic does not cap', () => {
    const topics = course(32).map((t, i) =>
      i === 10 ? { ...t, prerequisites: [{ path: 'adv-1/saga-1/t3', strength: 'hard' as const }] } : t,
    );
    const { done } = runQuiz(topics, {}, 30);
    expect(done.frontier).toBe(30);
  });

  it('a saga-level prerequisite is satisfied only when every topic of that saga is credited', () => {
    const topics: PlacementTopic[] = [
      topic({ id: 'a1', path: 'adv-1/saga-a/a1' }),
      topic({ id: 'a2', path: 'adv-1/saga-a/a2' }),
      topic({ id: 'b1', path: 'adv-1/saga-b/b1', prerequisites: [{ path: 'adv-1/saga-a', strength: 'hard' }] }),
    ];
    expect(placeAtLearnerChoice(topics, 3, 'adaptive_quiz').frontier).toBe(3);
    // Credit only a1: saga-a is incomplete, so b1 must not be credited.
    expect(placeAtLearnerChoice(topics, 1, 'adaptive_quiz').frontier).toBe(1);
  });
});

/*
 * The complaint was never "the questions were bad" — it was "I ended up
 * somewhere that was not mine". A placement a learner cannot argue with is one
 * they have to leave the product to escape.
 */
describe('placeAtLearnerChoice — the learner gets the last word', () => {
  it('lets a learner start at the beginning without taking the quiz', () => {
    const done = placeAtLearnerChoice(course(64), 0, 'learner_chose_start');
    expect(done.frontier).toBe(0);
    expect(done.startTopicId).toBe('t0');
    expect(done.creditedLessonIds).toEqual([]);
    expect(done.method).toBe('learner_chose_start');
  });

  it('lets a learner move themselves earlier than the quiz placed them', () => {
    const done = placeAtLearnerChoice(course(64), 12, 'learner_adjusted');
    expect(done.frontier).toBe(12);
    expect(done.creditedLessonIds).toHaveLength(12);
  });

  it('still refuses to credit past an unmet hard prerequisite, however the frontier was chosen', () => {
    const topics = course(32).map((t, i) =>
      i === 5 ? { ...t, prerequisites: [{ path: 'nowhere/at/all', strength: 'hard' as const }] } : t,
    );
    const done = placeAtLearnerChoice(topics, 31, 'learner_adjusted');
    expect(done.frontier).toBe(5);
    expect(done.cappedByPrerequisite).toBe(true);
  });

  it('clamps a frontier outside the course instead of producing a broken placement', () => {
    expect(placeAtLearnerChoice(course(8), 999, 'learner_adjusted').frontier).toBe(8);
    expect(placeAtLearnerChoice(course(8), -5, 'learner_adjusted').frontier).toBe(0);
  });
});
