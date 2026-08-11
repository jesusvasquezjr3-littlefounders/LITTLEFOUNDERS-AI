import { describe, expect, it } from 'vitest';
import { assembleCourseTree, findLessonNode, summarizeCourseTree } from '../services/courseTree.js';

const course = { id: 'course-1', slug: 'financial-education', title: { 'en-US': 'FinEd' }, description: {}, subject: 'money' };

const adventures = [
  { id: 'a1', course_id: 'course-1', position: 1, slug: 'adventure-1', title: {}, description: {}, theme: 'archipelago' },
  { id: 'a2', course_id: 'course-1', position: 2, slug: 'adventure-2', title: {}, description: {}, theme: 'forest' },
];

const sagas = [
  { id: 's1', adventure_id: 'a1', position: 1, slug: 'saga-1', title: {}, icon: 'auto_stories' },
  { id: 's2', adventure_id: 'a2', position: 1, slug: 'saga-2', title: {}, icon: 'auto_stories' },
];

const topics = [
  { id: 't1', saga_id: 's1', position: 1, slug: 'topic-1', title: {} },
  { id: 't2', saga_id: 's2', position: 1, slug: 'topic-2', title: {} },
];

const lessons = [
  { id: 'l1', topic_id: 't1', position: 1, slug: 'lesson-1', title: {}, difficulty: 1, xp_total: 30, estimated_minutes: 5 },
  { id: 'l2', topic_id: 't1', position: 2, slug: 'lesson-2', title: {}, difficulty: 1, xp_total: 30, estimated_minutes: 5 },
  { id: 'l3', topic_id: 't2', position: 1, slug: 'lesson-3', title: {}, difficulty: 2, xp_total: 40, estimated_minutes: 6 },
];

describe('assembleCourseTree', () => {
  it('computes lesson states, adventure locking and progress rollups in global order', () => {
    const progress = [{ lesson_id: 'l1', best_score: 100, passed: true, attempts: 1, xp_earned: 30 }];
    const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, progress);

    const [adv1, adv2] = tree.adventures;
    expect(adv1?.sagas[0]?.topics[0]?.lessons.map((l) => [l.id, l.state])).toEqual([
      ['l1', 'passed'],
      ['l2', 'current'],
    ]);
    expect(adv2?.sagas[0]?.topics[0]?.lessons.map((l) => [l.id, l.state])).toEqual([['l3', 'locked']]);

    // adv1 not fully cleared (l2 unpassed) -> available, not completed.
    expect(adv1?.state).toBe('available');
    // adv2 gated on adv1, which isn't fully passed -> locked.
    expect(adv2?.state).toBe('locked');

    expect(tree.course.progress).toEqual({ passed: 1, total: 3, pct: 33 });
    expect(tree.nextLessonId).toBe('l2');
  });

  it('passes the 0042 competency-graph projection (prerequisites/placementProbe) through inertly, defaulting when absent', () => {
    const topicsWithGraph = [
      {
        ...topics[0]!,
        prerequisites: [{ path: 'adventure-1/saga-0', strength: 'hard' as const, reason: 'needs counting first' }],
        placement_probe: { 'es-MX': { prompt: '¿Qué es el dinero?', options: ['a', 'b'], correctIndex: 0 } },
      },
      topics[1]!, // no 0042 columns at all — pre-migration-shaped row
    ];
    const tree = assembleCourseTree(course, adventures, sagas, topicsWithGraph, lessons, []);
    const topicWithGraph = tree.adventures[0]?.sagas[0]?.topics[0];
    expect(topicWithGraph?.prerequisites).toEqual([{ path: 'adventure-1/saga-0', strength: 'hard', reason: 'needs counting first' }]);
    expect(topicWithGraph?.placementProbe).toEqual({ 'es-MX': { prompt: '¿Qué es el dinero?', options: ['a', 'b'], correctIndex: 0 } });

    const topicWithoutGraph = tree.adventures[1]?.sagas[0]?.topics[0];
    expect(topicWithoutGraph?.prerequisites).toEqual([]);
    expect(topicWithoutGraph?.placementProbe).toBeNull();
  });

  it('unlocks the second adventure once the first is fully passed', () => {
    const progress = [
      { lesson_id: 'l1', best_score: 100, passed: true, attempts: 1, xp_earned: 30 },
      { lesson_id: 'l2', best_score: 90, passed: true, attempts: 1, xp_earned: 27 },
    ];
    const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, progress);
    expect(tree.adventures[0]?.state).toBe('completed');
    expect(tree.adventures[1]?.state).toBe('available');
    expect(tree.adventures[1]?.sagas[0]?.topics[0]?.lessons[0]?.state).toBe('current');
    expect(tree.nextLessonId).toBe('l3');
  });

  it('reports bestScore per lesson and defaults to 0 when never attempted', () => {
    const progress = [{ lesson_id: 'l1', best_score: 87, passed: true, attempts: 2, xp_earned: 26 }];
    const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, progress);
    const lessonsFlat = tree.adventures.flatMap((a) => a.sagas.flatMap((s) => s.topics.flatMap((t) => t.lessons)));
    expect(lessonsFlat.find((l) => l.id === 'l1')?.bestScore).toBe(87);
    expect(lessonsFlat.find((l) => l.id === 'l2')?.bestScore).toBe(0);
  });
});

describe('summarizeCourseTree', () => {
  it('rolls up adventureCount/lessonCount/progress for the /learn/courses list', () => {
    const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, []);
    const summary = summarizeCourseTree(course, tree);
    expect(summary).toMatchObject({
      id: 'course-1',
      slug: 'financial-education',
      adventureCount: 2,
      lessonCount: 3,
      progress: { passed: 0, total: 3, pct: 0 },
    });
  });
});

describe('findLessonNode', () => {
  it('finds a lesson anywhere in the tree', () => {
    const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, []);
    expect(findLessonNode(tree, 'l3')?.slug).toBe('lesson-3');
    expect(findLessonNode(tree, 'missing')).toBeNull();
  });
});

describe('territory topic states (0016)', () => {
  const reviewTopics = [
    { id: 't1', saga_id: 's1', position: 1, slug: 'topic-1', title: {}, kind: 'teaching', review_of: [] },
    { id: 't2', saga_id: 's2', position: 1, slug: 'topic-2', title: {}, kind: 'review_spaced', review_of: ['adventure-1/saga-1/topic-1'] },
  ];

  it('derives completed / in-progress / not-started from server-graded passes', () => {
    const tree = assembleCourseTree(course, adventures, sagas, reviewTopics, lessons, [
      { lesson_id: 'l1', passed: true, best_score: 100 },
    ]);
    // t1 has l1 passed, l2 not → in-progress; t2 untouched → not-started.
    expect(tree.adventures[0]?.sagas[0]?.topics[0]?.state).toBe('in-progress');
    expect(tree.adventures[1]?.sagas[0]?.topics[0]?.state).toBe('not-started');
  });

  it('flips a COMPLETED cited topic to review-due while its review topic has unpassed lessons', () => {
    const tree = assembleCourseTree(course, adventures, sagas, reviewTopics, lessons, [
      { lesson_id: 'l1', passed: true, best_score: 100 },
      { lesson_id: 'l2', passed: true, best_score: 90 },
    ]);
    expect(tree.adventures[0]?.sagas[0]?.topics[0]?.state).toBe('review-due');
    expect(tree.adventures[0]?.sagas[0]?.topics[0]?.kind).toBe('teaching');
  });

  it('review passed → the cited topic stays completed (nothing due)', () => {
    const tree = assembleCourseTree(course, adventures, sagas, reviewTopics, lessons, [
      { lesson_id: 'l1', passed: true, best_score: 100 },
      { lesson_id: 'l2', passed: true, best_score: 90 },
      { lesson_id: 'l3', passed: true, best_score: 80 },
    ]);
    expect(tree.adventures[0]?.sagas[0]?.topics[0]?.state).toBe('completed');
  });

  it('a saga-level citation ("adv/saga") covers every topic of that saga', () => {
    const sagaCite = [
      { id: 't1', saga_id: 's1', position: 1, slug: 'topic-1', title: {}, kind: 'teaching', review_of: [] },
      { id: 't2', saga_id: 's2', position: 1, slug: 'topic-2', title: {}, kind: 'review_quest', review_of: ['adventure-1/saga-1'] },
    ];
    const tree = assembleCourseTree(course, adventures, sagas, sagaCite, lessons, [
      { lesson_id: 'l1', passed: true, best_score: 100 },
      { lesson_id: 'l2', passed: true, best_score: 90 },
    ]);
    expect(tree.adventures[0]?.sagas[0]?.topics[0]?.state).toBe('review-due');
  });

  it('pre-0016 rows (no kind/review_of) default to teaching with no effect', () => {
    const tree = assembleCourseTree(course, adventures, sagas, topics, lessons, []);
    expect(tree.adventures[0]?.sagas[0]?.topics[0]?.kind).toBe('teaching');
    expect(tree.adventures[0]?.sagas[0]?.topics[0]?.state).toBe('not-started');
  });
});
