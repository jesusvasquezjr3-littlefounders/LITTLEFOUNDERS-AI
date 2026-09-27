import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SeedSchema } from '../../scripts/seed-kc-graph.js';
import { assembleCourseTree } from '../courseTree.js';
import { KcTopicMapSchema, deriveTopicKcLinks } from './kcTopicMap.js';
import {
  LEGACY_AGE_TIER_POLICY,
  LEGACY_EVIDENCE_EQUIVALENCE,
  chapterOpensForAge,
  chapterPolicy,
  chapterPrerequisiteKcs,
  computeFrontier,
  coursePrerequisiteDecision,
  earlyStageCandidate,
  earnedStagesFromBadgeRows,
  learnerAgeEvidence,
  learnerStage,
  pathwayBadgeDecision,
  pathwayProgress,
  resolvePathway,
  type AgeEvidence,
  type ChapterPolicy,
  type LearnerEvidence,
  type PathwayChapter,
  type TopicKcs,
} from './pathwayPolicy.js';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const born = (age: number): string => `${2026 - age - 1}-12-01`; // birthday not yet reached in 2026 → exactly `age`
const exact = (age: number): AgeEvidence => learnerAgeEvidence({ birthDate: born(age), declaredBand: null, protectedOrigin: false }, NOW);
const legacy = (tier: string): ChapterPolicy => chapterPolicy({ id: 'x', age_tier: tier })!;
const explicit = (stage: string, min: number, max: number | null): ChapterPolicy | null =>
  chapterPolicy({ id: 'x', age_tier: 'tier1', pathway_stage: stage, eligibility_min_age: min, eligibility_max_age: max });

const noEvidence = (): LearnerEvidence => ({ passedLessonIds: new Set(), creditedLessonIds: new Set(), mentorPKnown: new Map(), dueReviewKcs: new Set() });

describe('P1 chapter policy', () => {
  it('derives every legacy age tier from the taxonomy ranges', () => {
    expect(legacy('tier1')).toEqual({ stage: 'child', minAge: 6, maxAge: 7, source: 'legacy-age-tier' });
    expect(legacy('tier2')).toEqual({ stage: 'child', minAge: 8, maxAge: 10, source: 'legacy-age-tier' });
    expect(legacy('tier3')).toEqual({ stage: 'tween', minAge: 11, maxAge: 12, source: 'legacy-age-tier' });
    expect(legacy('tier4')).toEqual({ stage: 'teen', minAge: 12, maxAge: 18, source: 'legacy-age-tier' });
    expect(Object.keys(LEGACY_AGE_TIER_POLICY)).toEqual(['tier1', 'tier2', 'tier3', 'tier4']);
  });

  it('prefers complete explicit columns and fails closed on half-filled, incoherent or unknown rows', () => {
    expect(explicit('adult', 18, null)).toEqual({ stage: 'adult', minAge: 18, maxAge: null, source: 'explicit' });
    expect(chapterPolicy({ id: 'x', age_tier: 'tier1', pathway_stage: 'adult' })).toBeNull();
    expect(chapterPolicy({ id: 'x', age_tier: 'tier1', eligibility_min_age: 18 })).toBeNull();
    expect(explicit('teen', 16, 14)).toBeNull();
    expect(explicit('teen', 6, 9)).toBeNull(); // a "teen" chapter for 6–9 is an authoring error
    expect(explicit('child', 13, null)).toBeNull();
    expect(explicit('elder', 60, null)).toBeNull();
    expect(chapterPolicy({ id: 'x', age_tier: 'tier9' })).toBeNull();
  });
});

describe('P2/P3 age evidence and stage follow age, never role', () => {
  it('reads an exact age from a valid birth date and falls back to the declared band', () => {
    expect(exact(9)).toEqual({ lowerBound: 9, upperBound: 9, exact: true });
    expect(learnerAgeEvidence({ birthDate: '2026-02-30', declaredBand: '13_to_17', protectedOrigin: false }, NOW)).toEqual({ lowerBound: 13, upperBound: 17, exact: false });
    expect(learnerAgeEvidence({ birthDate: null, declaredBand: 'adult', protectedOrigin: false }, NOW)).toEqual({ lowerBound: 18, upperBound: null, exact: false });
    expect(learnerAgeEvidence({ birthDate: null, declaredBand: 'under_13', protectedOrigin: false }, NOW)).toEqual({ lowerBound: null, upperBound: 12, exact: false });
    expect(learnerAgeEvidence({ birthDate: null, declaredBand: null, protectedOrigin: false }, NOW)).toEqual({ lowerBound: null, upperBound: null, exact: false });
  });

  it('caps an under-13 protected origin (the A.2 guest path) at 12 whatever date or band was typed', () => {
    expect(learnerAgeEvidence({ birthDate: born(30), declaredBand: 'adult', protectedOrigin: true }, NOW)).toEqual({ lowerBound: 12, upperBound: 12, exact: false });
    expect(learnerStage(learnerAgeEvidence({ birthDate: null, declaredBand: 'under_13', protectedOrigin: true }, NOW))).toBe('child');
  });

  it('places stage boundaries on the Bible registers', () => {
    expect([5, 6, 9, 10, 12, 13, 17, 18, 45].map((a) => learnerStage(exact(a)))).toEqual(['child', 'child', 'child', 'tween', 'tween', 'teen', 'teen', 'adult', 'adult']);
    expect(learnerStage({ lowerBound: null, upperBound: null, exact: false })).toBe('child');
  });
});

describe('P4 safeguard', () => {
  it('opens child chapters to everyone and older chapters only at the minimum age', () => {
    expect(chapterOpensForAge({ lowerBound: null, upperBound: null, exact: false }, legacy('tier1'))).toBe(true);
    expect(chapterOpensForAge(exact(40), legacy('tier2'))).toBe(true);
    expect(chapterOpensForAge(exact(11), legacy('tier4'))).toBe(false);
    expect(chapterOpensForAge(exact(12), legacy('tier4'))).toBe(true);
    expect(chapterOpensForAge({ lowerBound: null, upperBound: 12, exact: false }, legacy('tier4'))).toBe(false);
    expect(chapterOpensForAge(learnerAgeEvidence({ birthDate: null, declaredBand: '13_to_17', protectedOrigin: false }, NOW), legacy('tier4'))).toBe(true);
    expect(chapterOpensForAge(exact(17), explicit('adult', 18, null))).toBe(false);
    expect(chapterOpensForAge(exact(30), null)).toBe(false);
  });
});

const FE = [
  { id: 'fe-1', policy: legacy('tier1') },
  { id: 'fe-6', policy: legacy('tier2') },
];
const INVESTING = [{ id: 'inv-1', policy: legacy('tier4') }];
const FUTURE = [
  { id: 'kids', policy: explicit('child', 6, 9) },
  { id: 'tweens', policy: explicit('tween', 10, 12) },
  { id: 'teens', policy: explicit('teen', 13, 17) },
  { id: 'adults', policy: explicit('adult', 18, null) },
];

describe('P5 pathway per population', () => {
  const access = (r: ReturnType<typeof resolvePathway>) => Object.fromEntries(r.access);

  it('parent-created 7-year-old: own child pathway in FE, investing unavailable', () => {
    expect(resolvePathway(exact(7), FE)).toMatchObject({ learnerStage: 'child', pathwayStage: 'child', basis: 'own-stage' });
    expect(access(resolvePathway(exact(7), FE))).toEqual({ 'fe-1': 'pathway', 'fe-6': 'pathway' });
    expect(resolvePathway(exact(7), INVESTING)).toMatchObject({ pathwayStage: null, basis: 'unavailable' });
    expect(access(resolvePathway(exact(7), INVESTING))).toEqual({ 'inv-1': 'closed' });
  });

  it('guest from the refusal path (no date): child only, nothing older opens', () => {
    const guest = learnerAgeEvidence({ birthDate: null, declaredBand: 'under_13', protectedOrigin: true }, NOW);
    expect(resolvePathway(guest, FE).basis).toBe('own-stage');
    expect(access(resolvePathway(guest, FUTURE))).toEqual({ kids: 'pathway', tweens: 'closed', teens: 'closed', adults: 'closed' });
  });

  it('independent teen 15: own teen pathway in investing; FE child chapters as the younger bridge', () => {
    expect(resolvePathway(exact(15), INVESTING)).toMatchObject({ pathwayStage: 'teen', basis: 'own-stage' });
    expect(resolvePathway(exact(15), FE)).toMatchObject({ pathwayStage: 'child', basis: 'younger-bridge' });
    expect(access(resolvePathway(exact(15), FUTURE))).toEqual({ kids: 'optional', tweens: 'optional', teens: 'pathway', adults: 'closed' });
  });

  it('adult 30 (including a verified-parent Tutor, whose role changes nothing): adult pathway when authored, never measured on childhood chapters', () => {
    expect(access(resolvePathway(exact(30), FUTURE))).toEqual({ kids: 'optional', tweens: 'optional', teens: 'optional', adults: 'pathway' });
    // Legacy catalog has no adult chapters: today's adults keep the teen chapters as a reported bridge.
    expect(resolvePathway(exact(30), INVESTING)).toMatchObject({ pathwayStage: 'teen', basis: 'younger-bridge' });
  });

  it('12-year-old enters the 12–18 legacy chapters early; 11-year-old cannot', () => {
    expect(resolvePathway(exact(12), INVESTING)).toMatchObject({ learnerStage: 'tween', pathwayStage: 'teen', basis: 'older-early' });
    expect(resolvePathway(exact(11), INVESTING)).toMatchObject({ pathwayStage: null, basis: 'unavailable' });
  });

  it('a minor never gets an adult chapter as pathway or optional, however the catalog is shaped', () => {
    for (const age of [6, 9, 12, 13, 17]) {
      expect(resolvePathway(exact(age), [{ id: 'adults', policy: explicit('adult', 18, null) }]).access.get('adults')).toBe('closed');
    }
  });

  it('a birthday moves the pathway forward and leaves the earlier stage optional, never closed', () => {
    const tweens = [{ id: 'tweens', policy: explicit('tween', 10, 12) }, { id: 'teens', policy: explicit('teen', 13, 17) }];
    expect(access(resolvePathway(exact(12), tweens))).toEqual({ tweens: 'pathway', teens: 'closed' });
    expect(access(resolvePathway(exact(13), tweens))).toEqual({ tweens: 'optional', teens: 'pathway' });
  });
});

describe('P7 course prerequisites across stages (B.2 × OD-16)', () => {
  const ENTREPRENEURSHIP = [{ id: 'ent-1', policy: legacy('tier4') }];
  it("a teen entering investing: financial education (a children's course) is waived, entrepreneurship (own stage) is still required", () => {
    expect(coursePrerequisiteDecision(resolvePathway(exact(15), FE), new Set())).toBe('waived-younger-stage');
    expect(coursePrerequisiteDecision(resolvePathway(exact(15), ENTREPRENEURSHIP), new Set())).toBe('missing');
    expect(coursePrerequisiteDecision(resolvePathway(exact(15), ENTREPRENEURSHIP), new Set(['teen']))).toBe('satisfied');
  });

  it("an adult never has to finish a younger stage's course; a 12-year-old still finishes the early-entry course", () => {
    expect(coursePrerequisiteDecision(resolvePathway(exact(30), FE), new Set())).toBe('waived-younger-stage');
    expect(coursePrerequisiteDecision(resolvePathway(exact(30), ENTREPRENEURSHIP), new Set())).toBe('waived-younger-stage');
    expect(coursePrerequisiteDecision(resolvePathway(exact(12), ENTREPRENEURSHIP), new Set())).toBe('missing');
  });

  it('a child keeps the prerequisite, and a frozen legacy badge of any stage satisfies it', () => {
    expect(coursePrerequisiteDecision(resolvePathway(exact(8), FE), new Set())).toBe('missing');
    expect(coursePrerequisiteDecision(resolvePathway(exact(8), FE), earnedStagesFromBadgeRows([{ award_key: 'legacy', pathway_stage: 'child' }]))).toBe('satisfied');
    expect(coursePrerequisiteDecision(resolvePathway(exact(8), INVESTING), new Set())).toBe('missing');
  });
});

// ---------------------------------------------------------------------------
// Frontier fixture: one course, two pathway chapters, one optional chapter.
//   k.a ──▶ k.b ──▶ k.c        k.gap (taught nowhere) ──▶ k.c
//   k.x (taught only in the optional chapter) ──▶ k.y
// ---------------------------------------------------------------------------
const topic = (p: string, position: number, lessons: number, extra: Partial<PathwayChapter['sagas'][number]['topics'][number]> = {}) => ({
  id: `id:${p}`, path: p, position, kind: 'teaching' as const,
  lessonIds: Array.from({ length: lessons }, (_, i) => `${p}#${i + 1}`), hardPrerequisites: [], reviewOf: [], ...extra,
});
const CHAPTERS: PathwayChapter[] = [
  { id: 'ch1', position: 1, policy: legacy('tier4'), sagas: [
    { id: 's1', position: 1, topics: [topic('ch1/s1/ta', 1, 2), topic('ch1/s1/tb', 2, 1), topic('ch1/s1/r', 3, 1, { kind: 'review_spaced', reviewOf: ['ch1/s1'] })] },
    { id: 's2', position: 2, topics: [topic('ch1/s2/tc', 1, 1)] },
  ] },
  { id: 'ch2', position: 2, policy: legacy('tier4'), sagas: [
    { id: 's3', position: 1, topics: [topic('ch2/s3/ty', 1, 1), topic('ch2/s3/tz', 2, 1, { hardPrerequisites: ['ch1/s2/tc'] })] },
  ] },
  { id: 'kid', position: 0, policy: legacy('tier1'), sagas: [
    { id: 's0', position: 1, topics: [topic('kid/s0/tx', 1, 1)] },
  ] },
];
const KCS = new Map<string, TopicKcs>([
  ['ch1/s1/ta', { teaches: ['k.a'], reviews: [] }],
  ['ch1/s1/tb', { teaches: ['k.b'], reviews: [] }],
  ['ch1/s1/r', { teaches: [], reviews: ['k.a', 'k.b'] }],
  ['ch1/s2/tc', { teaches: ['k.c'], reviews: [] }],
  ['ch2/s3/ty', { teaches: ['k.y'], reviews: [] }],
  ['ch2/s3/tz', { teaches: ['k.z'], reviews: [] }],
  ['kid/s0/tx', { teaches: ['k.x'], reviews: [] }],
]);
const PREREQS = new Map<string, string[]>([['k.b', ['k.a']], ['k.c', ['k.b', 'k.gap']], ['k.y', ['k.x']]]);
const teenAccess = resolvePathway(exact(15), CHAPTERS.map((c) => ({ id: c.id, policy: c.policy }))).access;

describe('F1–F6 frontier', () => {
  it('a fresh teen sees every open saga; a blocked saga names its earlier missing KC; prerequisites taught only outside the pathway are advisory bridges', () => {
    const f = computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, noEvidence());
    expect(f.items.map((i) => [i.topicPath, i.reason, i.lessonId, i.access])).toEqual([
      ['ch1/s1/ta', 'next', 'ch1/s1/ta#1', 'pathway'],
      ['ch2/s3/ty', 'next', 'ch2/s3/ty#1', 'pathway'], // k.x is taught only in the optional child chapter: never required (OD-16)
      ['kid/s0/tx', 'bridge', 'kid/s0/tx#1', 'optional'],
    ]);
    // k.gap is taught nowhere and k.x nowhere in the pathway: neither blocks.
    expect(f.blocked).toEqual([{ sagaId: 's2', topicPath: 'ch1/s2/tc', missingKcs: ['k.b'], missingTopics: [] }]);
    expect(f.advisoryKcs).toEqual(['k.gap', 'k.x']);
  });

  it('keeps authored order inside a saga and moves to the first unpassed lesson of a topic', () => {
    const e = noEvidence();
    (e.passedLessonIds as Set<string>).add('ch1/s1/ta#1');
    expect(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, e).items[0]).toMatchObject({ topicPath: 'ch1/s1/ta', lessonId: 'ch1/s1/ta#2' });
  });

  it('opens dependents from graded completion, from placement credit, and from the Mentor posterior at its own 0.80 bar', () => {
    const passed = noEvidence();
    ['ch1/s1/ta#1', 'ch1/s1/ta#2'].forEach((id) => (passed.passedLessonIds as Set<string>).add(id));
    expect(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, passed).items.map((i) => i.topicPath)).toContain('ch1/s1/tb');

    const credited = noEvidence();
    ['ch1/s1/ta#1', 'ch1/s1/ta#2', 'ch1/s1/tb#1'].forEach((id) => (credited.creditedLessonIds as Set<string>).add(id));
    expect(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, credited).items.map((i) => i.topicPath)).toEqual(expect.arrayContaining(['ch1/s1/r', 'ch1/s2/tc']));

    const mentor = noEvidence();
    (mentor.mentorPKnown as Map<string, number>).set('k.b', 0.8);
    // Mentor mastery: the course can never show a Mentor-mastered KC's dependents as locked.
    expect(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, mentor).items.map((i) => i.topicPath)).toContain('ch1/s2/tc');
    (mentor.mentorPKnown as Map<string, number>).set('k.b', 0.79);
    // 0.79 is below the Mentor's own prerequisite bar.
    expect(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, mentor).items.map((i) => i.topicPath)).not.toContain('ch1/s2/tc');
  });

  it('OD-24: a legacy KC credit is course evidence that opens dependents, and never completes the topic that teaches it', () => {
    const e = noEvidence();
    (e as { legacyCreditedKcs?: Set<string> }).legacyCreditedKcs = new Set(['k.b']);
    const f = computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, e);
    expect(f.items.map((i) => i.topicPath)).toContain('ch1/s2/tc');
    expect(f.blocked).toEqual([]);
    // The topic that teaches k.b is still offered: the credit satisfies the skill, it never passes lessons.
    expect(pathwayProgress(CHAPTERS, teenAccess, KCS, e)).toMatchObject({ passed: 0, complete: false, kcsSatisfied: 1 });
    // Without the credit the same saga is blocked on k.b (control).
    expect(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, noEvidence()).blocked.map((b) => b.missingKcs)).toEqual([['k.b']]);
  });

  it('opens a review topic only once what it reviews is complete, and honours authored hard prerequisites', () => {
    const e = noEvidence();
    ['ch1/s1/ta#1', 'ch1/s1/ta#2', 'ch1/s1/tb#1', 'kid/s0/tx#1', 'ch2/s3/ty#1'].forEach((id) => (e.passedLessonIds as Set<string>).add(id));
    const f = computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, e);
    expect(f.items.map((i) => [i.topicPath, i.reason])).toEqual([['ch1/s1/r', 'review'], ['ch1/s2/tc', 'next']]);
    expect(f.blocked).toEqual([{ sagaId: 's3', topicPath: 'ch2/s3/tz', missingKcs: [], missingTopics: ['ch1/s2/tc'] }]);
  });

  it('leads with one review-due item from the Mentor memory card', () => {
    const e = noEvidence();
    ['ch1/s1/ta#1', 'ch1/s1/ta#2', 'ch1/s1/tb#1'].forEach((id) => (e.passedLessonIds as Set<string>).add(id));
    (e.dueReviewKcs as Set<string>).add('k.a');
    const f = computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, e);
    expect(f.items[0]).toMatchObject({ topicPath: 'ch1/s1/r', reason: 'review-due' });
    expect(f.items.filter((i) => i.topicPath === 'ch1/s1/r')).toHaveLength(1);
  });

  it('never offers a closed chapter: an 11-year-old gets nothing from teen chapters', () => {
    const access = resolvePathway(exact(11), CHAPTERS.map((c) => ({ id: c.id, policy: c.policy }))).access;
    const f = computeFrontier(CHAPTERS, access, KCS, PREREQS, noEvidence());
    expect(f.items.every((i) => i.chapterId === 'kid')).toBe(true);
  });

  it('is deterministic', () => {
    expect(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, noEvidence())).toEqual(computeFrontier(CHAPTERS, teenAccess, KCS, PREREQS, noEvidence()));
  });
});

describe('B1–B5 progress, completion and badges', () => {
  it('measures a teen on the pathway only; the optional child chapter is never in the denominator', () => {
    const e = noEvidence();
    (e.passedLessonIds as Set<string>).add('kid/s0/tx#1');
    (e.passedLessonIds as Set<string>).add('ch1/s1/ta#1');
    expect(pathwayProgress(CHAPTERS, teenAccess, KCS, e)).toEqual({ passed: 1, total: 7, pct: 14, kcsTaught: 5, kcsSatisfied: 0, complete: false });
  });

  it('reproduces the legacy course percentage exactly for a single-stage course (no migrated number moves, OD-9)', () => {
    const lessons = CHAPTERS.filter((c) => c.id !== 'kid').flatMap((c) => c.sagas.flatMap((s) => s.topics.flatMap((t) => t.lessonIds.map((id, i) => ({ id, topic_id: t.id, position: i + 1, slug: id, title: {}, difficulty: 1, xp_total: 10, estimated_minutes: 5 })))));
    const tree = assembleCourseTree(
      { id: 'c', slug: 'c', title: {}, description: {}, subject: 'money' },
      CHAPTERS.filter((c) => c.id !== 'kid').map((c) => ({ id: c.id, course_id: 'c', position: c.position, slug: c.id, title: {}, description: {}, theme: 'city' })),
      CHAPTERS.filter((c) => c.id !== 'kid').flatMap((c) => c.sagas.map((s) => ({ id: s.id, adventure_id: c.id, position: s.position, slug: s.id, title: {}, icon: 'x' }))),
      CHAPTERS.filter((c) => c.id !== 'kid').flatMap((c) => c.sagas.flatMap((s) => s.topics.map((t) => ({ id: t.id, saga_id: s.id, position: t.position, slug: t.path, title: {} })))),
      lessons,
      [{ lesson_id: 'ch1/s1/ta#1', passed: true, best_score: 90 }, { lesson_id: 'ch1/s1/tb#1', passed: true, best_score: 70 }],
      new Set(['ch2/s3/ty#1']),
    );
    const e = noEvidence();
    ['ch1/s1/ta#1', 'ch1/s1/tb#1'].forEach((id) => (e.passedLessonIds as Set<string>).add(id));
    (e.creditedLessonIds as Set<string>).add('ch2/s3/ty#1');
    const p = pathwayProgress(CHAPTERS.filter((c) => c.id !== 'kid'), teenAccess, KCS, e);
    expect([p.passed, p.total, p.pct]).toEqual([tree.course.progress.passed, tree.course.progress.total, tree.course.progress.pct]);
  });

  it('completes the pathway only when every pathway topic is passed or credited; Mentor mastery alone never completes it', () => {
    const all = CHAPTERS.filter((c) => c.id !== 'kid').flatMap((c) => c.sagas.flatMap((s) => s.topics.flatMap((t) => [...t.lessonIds])));
    const mentorOnly = noEvidence();
    ['k.a', 'k.b', 'k.c', 'k.y', 'k.z'].forEach((k) => (mentorOnly.mentorPKnown as Map<string, number>).set(k, 0.99));
    expect(pathwayProgress(CHAPTERS, teenAccess, KCS, mentorOnly).complete).toBe(false);
    const done = noEvidence();
    all.forEach((id, i) => (i % 2 ? (done.passedLessonIds as Set<string>) : (done.creditedLessonIds as Set<string>)).add(id));
    const progress = pathwayProgress(CHAPTERS, teenAccess, KCS, done);
    expect(progress).toMatchObject({ complete: true, pct: 100, kcsSatisfied: 5, kcsTaught: 5 });
    const resolution = resolvePathway(exact(15), CHAPTERS.map((c) => ({ id: c.id, policy: c.policy })));
    expect(pathwayBadgeDecision(resolution, progress, new Set())).toEqual({ eligible: true, stage: 'teen', alreadyEarned: false, contentGap: false });
    expect(pathwayBadgeDecision(resolution, progress, new Set(['teen']))).toMatchObject({ eligible: false, alreadyEarned: true });
  });

  it('never awards an unavailable pathway and flags a bridge pathway as a content gap', () => {
    const unavailable = resolvePathway(exact(11), INVESTING);
    expect(pathwayBadgeDecision(unavailable, { passed: 0, total: 0, pct: 0, kcsTaught: 0, kcsSatisfied: 0, complete: true }, new Set())).toMatchObject({ eligible: false, contentGap: true });
    const adult = resolvePathway(exact(30), INVESTING);
    expect(pathwayBadgeDecision(adult, { passed: 1, total: 1, pct: 100, kcsTaught: 1, kcsSatisfied: 1, complete: true }, new Set())).toMatchObject({ eligible: true, stage: 'teen', contentGap: true });
  });

  it('counts a frozen legacy full-course badge as the credential of its stage', () => {
    expect([...earnedStagesFromBadgeRows([{ award_key: 'legacy', pathway_stage: 'child' }, { award_key: 'teen', pathway_stage: 'teen' }, { award_key: 'legacy', pathway_stage: null }])].sort()).toEqual(['child', 'teen']);
  });
});

describe('OD-9 legacy evidence equivalence', () => {
  it('lists every evidence type OD-9 §4.1 promises and drops none', () => {
    const listed = LEGACY_EVIDENCE_EQUIVALENCE.map((e) => e.evidence).join(' | ');
    for (const promised of ['lesson passes', 'placement credits', 'XP', 'coins', 'course badges', 'streaks', 'savings goals', 'chore history', 'Mentor plans and notebooks']) {
      expect(listed).toContain(promised);
    }
    expect(LEGACY_EVIDENCE_EQUIVALENCE.every((e) => e.treatment.startsWith('kept-as-is'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The whole real catalog: no pathway deadlocks on the shared graph.
// ---------------------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const seeds = path.resolve(here, '../../../../database/seeds');
const graph = SeedSchema.parse(JSON.parse(readFileSync(path.join(seeds, 'kc_graph.v1.json'), 'utf8')));
const map = KcTopicMapSchema.parse(JSON.parse(readFileSync(path.join(seeds, 'kc_topic_map.v1.json'), 'utf8')));
/** age_tier per adventure, from coursegen/curriculum (FE adventures 1–5 tier1, 6–8 tier2; investing and entrepreneurship tier4; the lemonade stand tier2). */
const tierOf = (course: string, adventureIndex: number): string =>
  course === 'financial-education' ? (adventureIndex < 5 ? 'tier1' : 'tier2') : course === 'first-lemonade-stand' ? 'tier2' : 'tier4';

function realCourse(course: string): { chapters: PathwayChapter[]; kcs: Map<string, TopicKcs> } {
  const entry = map.courses.find((c) => c.course === course)!;
  const links = deriveTopicKcLinks(map).filter((l) => l.course === course);
  const kcs = new Map<string, TopicKcs>();
  for (const l of links) {
    const k = kcs.get(l.topicPath) ?? { teaches: [], reviews: [] };
    (l.role === 'teaches' ? (k.teaches as string[]) : (k.reviews as string[])).push(l.kcKey);
    kcs.set(l.topicPath, k);
  }
  const chapters: PathwayChapter[] = [];
  for (const t of entry.topics) {
    const [adv, saga] = t.path.split('/') as [string, string, string];
    let chapter = chapters.find((c) => c.id === adv);
    if (!chapter) {
      chapter = { id: adv, position: chapters.length + 1, policy: legacy(tierOf(course, chapters.length)), sagas: [] };
      chapters.push(chapter);
    }
    let s = chapter.sagas.find((x) => x.id === `${adv}/${saga}`) as { id: string; position: number; topics: PathwayChapter['sagas'][number]['topics'][number][] } | undefined;
    if (!s) {
      s = { id: `${adv}/${saga}`, position: chapter.sagas.length + 1, topics: [] };
      (chapter.sagas as unknown[]).push(s);
    }
    s.topics.push({ id: t.path, path: t.path, position: s.topics.length + 1, kind: t.kind, lessonIds: [`${t.path}#1`, `${t.path}#2`], hardPrerequisites: t.requires ?? [], reviewOf: t.kind === 'teaching' ? [] : t.review_of });
  }
  return { chapters, kcs };
}
const prereqs = new Map<string, string[]>();
for (const [from, to] of graph.edges) prereqs.set(to, [...(prereqs.get(to) ?? []), from]);

describe('the real catalog on the real graph (S05.3a data, activated as if accepted)', () => {
  const populations: Array<[string, number]> = [['financial-education', 8], ['financial-education', 15], ['investing', 15], ['investing', 30], ['investing', 12], ['entrepreneurship', 16], ['first-lemonade-stand', 9]];

  const strategies = ['recommended', 'last-offered'] as const;
  it.each(populations.flatMap(([course, age]) => strategies.map((strategy) => [course, age, strategy] as const)))('%s, age %i, %s item each time: the frontier is never empty until the pathway is complete (no deadlock)', (course, age, strategy) => {
    const { chapters, kcs } = realCourse(course);
    const access = resolvePathway(exact(age), chapters.map((c) => ({ id: c.id, policy: c.policy }))).access;
    const evidence = noEvidence();
    let rounds = 0;
    for (;;) {
      const frontier = computeFrontier(chapters, access, kcs, prereqs, evidence);
      const pathwayItems = frontier.items.filter((i) => i.access === 'pathway');
      if (pathwayItems.length === 0) {
        expect(frontier.blocked, `${course} blocked with nothing open`).toEqual([]);
        break;
      }
      // One lesson at a time, either the recommended item or (adversarially) the last one offered.
      const pick = strategy === 'recommended' ? pathwayItems[0]! : pathwayItems[pathwayItems.length - 1]!;
      (evidence.passedLessonIds as Set<string>).add(pick.lessonId);
      rounds++;
      expect(rounds).toBeLessThan(5000);
    }
    expect(pathwayProgress(chapters, access, kcs, evidence)).toMatchObject({ complete: true, pct: 100 });
  });

  it('an 11-year-old has no pathway in the 12–18 courses and a 10-year-old keeps the whole child financial-education pathway', () => {
    const inv = realCourse('investing');
    expect(resolvePathway(exact(11), inv.chapters.map((c) => ({ id: c.id, policy: c.policy }))).basis).toBe('unavailable');
    const fe = realCourse('financial-education');
    const r = resolvePathway(exact(10), fe.chapters.map((c) => ({ id: c.id, policy: c.policy })));
    expect(r).toMatchObject({ learnerStage: 'tween', pathwayStage: 'child', basis: 'younger-bridge' });
    expect([...r.access.values()].every((a) => a === 'pathway')).toBe(true);
  });
});

describe('OD-25 — one stage early on mastery', () => {
  const teen: ChapterPolicy = { stage: 'teen', minAge: 13, maxAge: 17, source: 'explicit' };
  const tween: ChapterPolicy = { stage: 'tween', minAge: 10, maxAge: 12, source: 'explicit' };
  const adult: ChapterPolicy = { stage: 'adult', minAge: 18, maxAge: null, source: 'explicit' };
  const unknown: AgeEvidence = { lowerBound: null, upperBound: null, exact: false };

  it('a closed chapter exactly one stage above a known age is a candidate', () => {
    expect(earlyStageCandidate(exact(10), teen)).toBe(true);
    expect(earlyStageCandidate(exact(12), teen)).toBe(true);
    expect(earlyStageCandidate(exact(8), tween)).toBe(true);
  });

  it('never two stages up, never an adult chapter, never an open chapter, never an unknown age', () => {
    expect(earlyStageCandidate(exact(8), teen)).toBe(false);
    expect(earlyStageCandidate(exact(16), adult)).toBe(false);
    expect(earlyStageCandidate(exact(12), adult)).toBe(false);
    expect(earlyStageCandidate(exact(14), teen)).toBe(false); // already open by age
    expect(earlyStageCandidate(unknown, tween)).toBe(false);
    expect(earlyStageCandidate(learnerAgeEvidence({ birthDate: null, declaredBand: 'under_13', protectedOrigin: false }, NOW), tween)).toBe(false);
    expect(earlyStageCandidate(exact(10), null)).toBe(false);
  });

  it('the prerequisite skills of a chapter are the graph prerequisites of what it teaches, minus what it teaches itself', () => {
    const chapter: PathwayChapter = { id: 'c', position: 1, policy: teen, sagas: [{ id: 's', position: 1, topics: [
      { id: 't1', path: 'c/s/t1', position: 1, kind: 'teaching', lessonIds: ['l1'], hardPrerequisites: [], reviewOf: [] },
      { id: 't2', path: 'c/s/t2', position: 2, kind: 'teaching', lessonIds: ['l2'], hardPrerequisites: [], reviewOf: [] },
    ] }] };
    const kcs = new Map<string, TopicKcs>([['c/s/t1', { teaches: ['kc.a'], reviews: [] }], ['c/s/t2', { teaches: ['kc.b'], reviews: [] }]]);
    const prereqs = new Map<string, string[]>([['kc.a', ['kc.z', 'kc.y']], ['kc.b', ['kc.a', 'kc.y']]]);
    expect(chapterPrerequisiteKcs(chapter, kcs, prereqs)).toEqual(['kc.y', 'kc.z']);
    expect(chapterPrerequisiteKcs(chapter, kcs, new Map())).toEqual([]);
  });
});
