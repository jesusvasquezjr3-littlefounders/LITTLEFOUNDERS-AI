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
