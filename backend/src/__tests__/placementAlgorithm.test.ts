import { describe, expect, it } from 'vitest';
import { computePlacement, gradeQuizAnswers, type PlacementTopic } from '../services/placementAlgorithm.js';

describe('gradeQuizAnswers', () => {
  it('grades correct and incorrect answers against each topic\'s persisted probe', () => {
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
    const answers = [{ topicId: 't1', selectedIndex: 0 }, { topicId: 'stale-topic', selectedIndex: 0 }];
    expect(gradeQuizAnswers(probes, answers)).toEqual([{ topicId: 't1', correct: true }]);
  });
});

function topic(overrides: Partial<PlacementTopic> & Pick<PlacementTopic, 'id' | 'path'>): PlacementTopic {
  return { hasProbe: true, prerequisites: [], lessonIds: [`${overrides.id}-lesson`], ...overrides };
}

describe('computePlacement', () => {
  it('claimed_beginner_shortcut: "new" always starts at lesson 1 of topic 1, no quiz needed, no credits', () => {
    const topics = [topic({ id: 't1', path: 'adv-1/saga-1/t1' }), topic({ id: 't2', path: 'adv-1/saga-1/t2' })];
    const result = computePlacement(topics, 'new', [{ topicId: 't1', correct: true }]);
    expect(result).toEqual({ startTopicId: 't1', startLessonId: 't1-lesson', creditedLessonIds: [], method: 'claimed_beginner_shortcut' });
  });

  it('no_probe_content_fallback: a course with zero probed topics starts at lesson 1, credits nothing', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1', hasProbe: false }),
      topic({ id: 't2', path: 'adv-1/saga-1/t2', hasProbe: false }),
    ];
    const result = computePlacement(topics, 'confident', []);
    expect(result).toEqual({ startTopicId: 't1', startLessonId: 't1-lesson', creditedLessonIds: [], method: 'no_probe_content_fallback' });
  });

  it('handles an empty course without crashing', () => {
    expect(computePlacement([], 'confident', [])).toEqual({
      startTopicId: null,
      startLessonId: null,
      creditedLessonIds: [],
      method: 'claimed_beginner_shortcut',
    });
  });

  it('quiz: credits every topic in the contiguous correct-and-probed prefix, starts at the first uncredited topic', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({ id: 't2', path: 'adv-1/saga-1/t2' }),
      topic({ id: 't3', path: 'adv-1/saga-1/t3' }),
    ];
    const answers = [
      { topicId: 't1', correct: true },
      { topicId: 't2', correct: true },
      { topicId: 't3', correct: true },
    ];
    const result = computePlacement(topics, 'confident', answers);
    expect(result.method).toBe('quiz');
    expect(result.creditedLessonIds).toEqual(['t1-lesson', 't2-lesson', 't3-lesson']);
    expect(result.startTopicId).toBeNull(); // the whole (tiny) course was credited
    expect(result.startLessonId).toBeNull();
  });

  it('quiz: a wrong answer stops the prefix — nothing from that topic onward is credited', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({ id: 't2', path: 'adv-1/saga-1/t2' }),
      topic({ id: 't3', path: 'adv-1/saga-1/t3' }),
    ];
    const answers = [
      { topicId: 't1', correct: true },
      { topicId: 't2', correct: false },
      { topicId: 't3', correct: true },
    ];
    const result = computePlacement(topics, 'confident', answers);
    expect(result.creditedLessonIds).toEqual(['t1-lesson']);
    expect(result.startTopicId).toBe('t2');
    expect(result.startLessonId).toBe('t2-lesson');
  });

  it('quiz: an unprobed topic (e.g. a review checkpoint) stops the prefix and becomes the start — never skipped over', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({ id: 'review-1', path: 'adv-1/saga-1/review-1', hasProbe: false }),
      topic({ id: 't2', path: 'adv-1/saga-2/t2' }),
    ];
    const answers = [
      { topicId: 't1', correct: true },
      { topicId: 't2', correct: true }, // answered and correct, but unreachable — t1's neighbor has no probe
    ];
    const result = computePlacement(topics, 'confident', answers);
    expect(result.creditedLessonIds).toEqual(['t1-lesson']);
    expect(result.startTopicId).toBe('review-1');
  });

  it('quiz: a probed topic that was never asked (over the 6-question cap) stops the prefix just like an unprobed one', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({ id: 't2', path: 'adv-1/saga-1/t2' }), // hasProbe: true, but no graded answer below
      topic({ id: 't3', path: 'adv-1/saga-1/t3' }),
    ];
    const answers = [{ topicId: 't1', correct: true }, { topicId: 't3', correct: true }];
    const result = computePlacement(topics, 'confident', answers);
    expect(result.creditedLessonIds).toEqual(['t1-lesson']);
    expect(result.startTopicId).toBe('t2');
  });

  it('quiz: caps the credited prefix at the earliest unmet HARD topic-level prerequisite', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({
        id: 't2',
        path: 'adv-1/saga-1/t2',
        prerequisites: [{ path: 'adv-1/saga-0/counting', strength: 'hard' }], // not in this course's flat list at all
      }),
      topic({ id: 't3', path: 'adv-1/saga-1/t3' }),
    ];
    const answers = [
      { topicId: 't1', correct: true },
      { topicId: 't2', correct: true },
      { topicId: 't3', correct: true },
    ];
    const result = computePlacement(topics, 'confident', answers);
    // t2's hard prereq is never satisfied by anything before it -> cap BEFORE t2.
    expect(result.creditedLessonIds).toEqual(['t1-lesson']);
    expect(result.startTopicId).toBe('t2');
  });

  it('quiz: a hard prerequisite satisfied by an EARLIER credited topic in this same course does not cap anything', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({
        id: 't2',
        path: 'adv-1/saga-1/t2',
        prerequisites: [{ path: 'adv-1/saga-1/t1', strength: 'hard' }], // satisfied — t1 is credited and comes first
      }),
    ];
    const answers = [{ topicId: 't1', correct: true }, { topicId: 't2', correct: true }];
    const result = computePlacement(topics, 'confident', answers);
    expect(result.creditedLessonIds).toEqual(['t1-lesson', 't2-lesson']);
  });

  it('quiz: a hard prerequisite expressed as a whole-saga path is satisfied only once EVERY topic in that saga is credited', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({ id: 't2', path: 'adv-1/saga-1/t2' }),
      topic({
        id: 't3',
        path: 'adv-1/saga-2/t3',
        prerequisites: [{ path: 'adv-1/saga-1', strength: 'hard' }], // the whole of saga-1
      }),
    ];
    const answers = [
      { topicId: 't1', correct: true },
      { topicId: 't2', correct: true },
      { topicId: 't3', correct: true },
    ];
    const result = computePlacement(topics, 'confident', answers);
    expect(result.creditedLessonIds).toEqual(['t1-lesson', 't2-lesson', 't3-lesson']);
  });

  it('quiz: a SOFT prerequisite never caps the credited prefix, even when wildly unmet', () => {
    const topics = [
      topic({ id: 't1', path: 'adv-1/saga-1/t1' }),
      topic({
        id: 't2',
        path: 'adv-1/saga-1/t2',
        prerequisites: [{ path: 'adv-1/saga-0/nonexistent', strength: 'soft' }],
      }),
    ];
    const answers = [{ topicId: 't1', correct: true }, { topicId: 't2', correct: true }];
    const result = computePlacement(topics, 'confident', answers);
    expect(result.creditedLessonIds).toEqual(['t1-lesson', 't2-lesson']);
  });
});
