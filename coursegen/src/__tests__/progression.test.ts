import { describe, expect, it } from 'vitest';
import { checkProgression, orderCourse } from '../catalog/progression.js';
import type { CourseCatalog } from '../catalog/loader.js';

/*
 * The progression validator encodes the product promise: a course must take a
 * learner with ZERO prior knowledge to mastery, guiding them by the hand, with
 * day-over-day retention, without boring or saturating them. Each test below is
 * one of those promises, expressed as the shape that would break it.
 */

type Lesson = { position: number; slug: string; difficulty: 1 | 2 | 3 | 4 | 5; suggested_families: string[]; forced_types?: string[] };

function lesson(position: number, difficulty: Lesson['difficulty'], families: string[] = ['choice']): Lesson {
  return { position, slug: `l${position}`, difficulty, suggested_families: families, micro_objective: 'x', narrative_beat: 'y' } as unknown as Lesson;
}

function topic(position: number, slug: string, lessons: Lesson[], over: Record<string, unknown> = {}) {
  return {
    position, slug, kind: 'teaching', title_es: 't', concept: 'c', learning_objective: 'o',
    key_vocabulary: ['v'], prior_knowledge: 'p', fact_refs: [], lessons, ...over,
  };
}

/** Builds a minimal CourseCatalog the validator can walk. */
function course(sagas: Array<{ slug: string; kind?: string; topics: ReturnType<typeof topic>[] }>, catalogOver: Record<string, unknown> = {}): CourseCatalog {
  return {
    courseDir: 'curriculum/test',
    catalog: { course: { slug: 'test', ...catalogOver } } as unknown as CourseCatalog['catalog'],
    adventures: [
      {
        file: 'a1.yaml',
        data: {
          schema_version: 1,
          adventure: { position: 1, slug: 'adv', theme: 'money', age_tier: 'tier1', title: {}, description: {}, narrative_arc: 'n' },
          sagas: sagas.map((s, i) => ({ position: i + 1, slug: s.slug, kind: s.kind ?? 'teaching', title: {}, description: {}, topics: s.topics })),
        } as unknown as CourseCatalog['adventures'][number]['data'],
      },
    ],
  } as unknown as CourseCatalog;
}

const codes = (c: CourseCatalog) => checkProgression(c).map((i) => i.code);

describe('progression — a beginner can start (cold start)', () => {
  it('errors when the course opens above difficulty 1', () => {
    const c = course([{ slug: 's1', topics: [topic(1, 't1', [lesson(1, 3), lesson(2, 3)])] }]);
    const issues = checkProgression(c);
    expect(issues.some((i) => i.code === 'cold-start' && i.level === 'error')).toBe(true);
  });

  it('accepts a course that opens at difficulty 1', () => {
    const c = course([{ slug: 's1', topics: [topic(1, 't1', [lesson(1, 1), lesson(2, 2)])] }]);
    expect(codes(c)).not.toContain('cold-start');
  });
});

describe('progression — the ramp has no cliffs (incremental, hand-held)', () => {
  it('errors on a difficulty jump larger than one step', () => {
    const c = course([{ slug: 's1', topics: [topic(1, 't1', [lesson(1, 1), lesson(2, 4)])] }]);
    const issues = checkProgression(c);
    expect(issues.some((i) => i.code === 'ramp-cliff' && i.level === 'error')).toBe(true);
    expect(issues.find((i) => i.code === 'ramp-cliff')?.message).toContain('1→4');
  });

  it('allows one-step rises and any DROP (consolidation eases off on purpose)', () => {
    const c = course([{ slug: 's1', topics: [topic(1, 't1', [lesson(1, 1), lesson(2, 2), lesson(3, 3), lesson(4, 1)])] }]);
    expect(codes(c)).not.toContain('ramp-cliff');
  });

  it('checks the ramp ACROSS topic and saga boundaries, not just inside a topic', () => {
    const c = course([
      { slug: 's1', topics: [topic(1, 't1', [lesson(1, 1), lesson(2, 2)])] },
      { slug: 's2', topics: [topic(1, 't2', [lesson(1, 5)])] },
    ]);
    expect(codes(c)).toContain('ramp-cliff');
  });
});

describe('progression — what is taught comes back (retention)', () => {
  const teaching = { slug: 'taught', topics: [topic(1, 'tt', [lesson(1, 1), lesson(2, 2)])] };

  it('warns when a teaching saga is never reviewed', () => {
    const c = course([teaching]);
    expect(codes(c)).toContain('retention-gap');
  });

  it('warns when a saga is reviewed at only ONE distance (not spaced practice)', () => {
    const c = course([
      teaching,
      { slug: 'rev', kind: 'review', topics: [topic(1, 'r1', [lesson(1, 2)], { kind: 'review_spaced', review_of: ['adv/taught'] })] },
    ]);
    expect(codes(c)).toContain('retention-single-shot');
  });

  it('accepts a saga retrieved at two different distances', () => {
    const c = course([
      teaching,
      { slug: 'mid', topics: [topic(1, 'm1', [lesson(1, 2)])] },
      {
        slug: 'rev', kind: 'review',
        topics: [
          topic(1, 'r1', [lesson(1, 2)], { kind: 'review_spaced', review_of: ['adv/taught'] }),
          topic(2, 'r2', [lesson(1, 2)], { kind: 'review_interleaved', review_of: ['adv/taught'] }),
        ],
      },
    ]);
    // Assert about the RETENTION verdict for the saga under test specifically —
    // the filler "mid" saga is itself unreviewed, so it legitimately raises its
    // own retention-gap, and a short fixture can incidentally trip monotony.
    const retention = checkProgression(c).filter(
      (i) => (i.code.startsWith('retention') || i.code === 'first-review-too-far') && i.message.includes('adv/taught'),
    );
    expect(retention).toHaveLength(0);
  });

  it('does NOT invent duplicate-distance failures — a review topic may cite several topics of one saga', () => {
    /*
     * Regression for a rule I got wrong: requiring a strictly increasing RAW
     * citation sequence flagged all 32 teaching sagas of every large course (96
     * false warnings) because one review topic legitimately cites several topics
     * of the same saga, producing equal distances. Only DISTINCT distances matter.
     */
    const c = course([
      { slug: 'taught', topics: [topic(1, 'a', [lesson(1, 1)]), topic(2, 'b', [lesson(1, 2)])] },
      { slug: 'mid', topics: [topic(1, 'm', [lesson(1, 2)])] },
      {
        slug: 'rev', kind: 'review',
        topics: [
          topic(1, 'r1', [lesson(1, 2)], { kind: 'review_quest', review_of: ['adv/taught/a', 'adv/taught/b'] }),
          topic(2, 'r2', [lesson(1, 2)], { kind: 'review_quest', review_of: ['adv/taught/a', 'adv/taught/b'] }),
        ],
      },
    ]);
    expect(checkProgression(c).filter((i) => i.code.startsWith('review-not'))).toHaveLength(0);
  });

  it('exempts a standalone type-coverage catalog from retention checks', () => {
    const c = course([teaching], { standalone: true });
    const got = codes(c);
    expect(got).not.toContain('retention-gap');
    expect(got).not.toContain('retention-single-shot');
  });
});

describe('progression — never boring, never saturating', () => {
  it('warns on a long run of identically-shaped lessons', () => {
    const c = course([{
      slug: 's1',
      topics: [topic(1, 't1', [lesson(1, 1), lesson(2, 1), lesson(3, 1), lesson(4, 1), lesson(5, 1), lesson(6, 1)])],
    }]);
    const issues = checkProgression(c);
    expect(issues.some((i) => i.code === 'monotony')).toBe(true);
  });

  it('accepts a varied sequence', () => {
    const c = course([{
      slug: 's1',
      topics: [topic(1, 't1', [
        lesson(1, 1, ['choice']), lesson(2, 1, ['money']), lesson(3, 1, ['arrange']),
        lesson(4, 1, ['story']), lesson(5, 1, ['input']), lesson(6, 1, ['maker']),
      ])],
    }]);
    expect(codes(c)).not.toContain('monotony');
  });

  it('warns when one topic piles on too many new facts', () => {
    const c = course([{
      slug: 's1',
      topics: [topic(1, 't1', [lesson(1, 1)], { fact_refs: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'] })],
    }]);
    expect(codes(c)).toContain('cognitive-load');
  });

  it('warns when one topic spans too much of the difficulty scale', () => {
    const c = course([{
      slug: 's1',
      topics: [topic(1, 't1', [lesson(1, 1), lesson(2, 2), lesson(3, 3), lesson(4, 4)])],
    }]);
    expect(codes(c)).toContain('topic-difficulty-spread');
  });
});

describe('progression — orderCourse walks the learner order', () => {
  it('sorts sagas, topics and lessons by position, not file order', () => {
    const c = course([{
      slug: 's1',
      topics: [
        topic(2, 'second', [lesson(2, 2), lesson(1, 1)]),
        topic(1, 'first', [lesson(1, 1)]),
      ],
    }]);
    const { lessons } = orderCourse(c);
    expect(lessons.map((l) => `${l.topic}#${l.lesson.position}`)).toEqual(['first#1', 'second#1', 'second#2']);
  });
});
