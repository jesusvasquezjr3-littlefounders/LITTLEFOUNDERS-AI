import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SeedSchema } from '../../scripts/seed-kc-graph.js';
import {
  assembleCourseTree,
  flattenTopicsForPlacement,
  type AdventureRowLite,
  type CourseTree,
  type LessonRowLite,
  type SagaRowLite,
  type TopicRowLite,
} from '../courseTree.js';
import { applyCoursePathway, legacyCourseStage, lessonChapterAccess, pathwayBadgeAward, type CoursePathwayInputs, type PathwayCourseTree } from './coursePathway.js';
import { projectCoursePath } from './coursePathProjection.js';
import { KcTopicMapSchema, deriveTopicKcLinks } from './kcTopicMap.js';
import { chapterPolicy, learnerAgeEvidence, type AgeEvidence, type ChapterRowLite, type PathwayStage, type TopicKcs } from './pathwayPolicy.js';

/*
 * S05.3b — the pathway engine applied to real course trees. These are the
 * checkpoint's adversarial acceptance tests at the pure boundary; the HTTP
 * boundary (direct requests per population) is src/__tests__/learnPathway.test.ts.
 *
 *   - an adult never has to traverse childhood chapters;
 *   - a minor never depends on adult chapters;
 *   - a skill mastered with the Mentor never shows locked;
 *   - no existing credit, XP or badge is lost.
 */

const NOW = new Date('2026-09-24T12:00:00.000Z');
const born = (age: number): string => `${2026 - age - 1}-12-01`;
const ageOf = (age: number): AgeEvidence => learnerAgeEvidence({ birthDate: born(age), declaredBand: null, protectedOrigin: false }, NOW);

interface ChapterSpec { slug: string; row: Omit<ChapterRowLite, 'id'>; sagas: Array<{ slug: string; topics: Array<{ slug: string; teaches?: string[]; reviews?: string[]; kind?: string; reviewOf?: string[]; hard?: string[] }> }> }

function buildCourse(chapters: ChapterSpec[]) {
  const adventures: AdventureRowLite[] = [];
  const sagas: SagaRowLite[] = [];
  const topics: TopicRowLite[] = [];
  const lessons: LessonRowLite[] = [];
  const chapterRows = new Map<string, ChapterRowLite>();
  const topicKcs = new Map<string, TopicKcs>();
  const lessonsByTopic = new Map<string, string[]>();
  chapters.forEach((chapter, ci) => {
    adventures.push({ id: chapter.slug, course_id: 'course', position: ci + 1, slug: chapter.slug, title: { 'en-US': chapter.slug }, description: {}, theme: 't' });
    chapterRows.set(chapter.slug, { id: chapter.slug, ...chapter.row });
    chapter.sagas.forEach((saga, si) => {
      const sagaId = `${chapter.slug}/${saga.slug}`;
      sagas.push({ id: sagaId, adventure_id: chapter.slug, position: si + 1, slug: saga.slug, title: {}, icon: 'x' });
      saga.topics.forEach((topic, ti) => {
        const topicId = `${sagaId}/${topic.slug}`;
        topics.push({
          id: topicId, saga_id: sagaId, position: ti + 1, slug: topic.slug, title: { 'en-US': topic.slug },
          kind: topic.kind ?? 'teaching', review_of: topic.reviewOf ?? [],
          prerequisites: (topic.hard ?? []).map((p) => ({ path: p, strength: 'hard' as const, reason: 'authored' })),
          placement_probe: { 'en-US': { prompt: 'q', options: ['a', 'b'], correctIndex: 0 } },
        });
        topicKcs.set(topicId, { teaches: topic.teaches ?? [], reviews: topic.reviews ?? [] });
        const ids = [`${topicId}#1`, `${topicId}#2`];
        lessonsByTopic.set(topicId, ids);
        ids.forEach((id, li) => lessons.push({ id, topic_id: topicId, position: li + 1, slug: `l${li + 1}`, title: { 'en-US': id }, difficulty: 1, xp_total: 10, estimated_minutes: 4 }));
      });
    });
  });
  const course = { id: 'course', slug: 'course', title: { 'en-US': 'Course' }, description: {}, subject: 'money', badge_asset: 'b.png' };
  return { course, adventures, sagas, topics, lessons, chapterRows, topicKcs, lessonsByTopic };
}

type Built = ReturnType<typeof buildCourse>;

function linearTree(built: Built, passed: string[] = [], credited: string[] = [], placed = true): CourseTree {
  return assembleCourseTree(built.course, built.adventures, built.sagas, built.topics, built.lessons,
    passed.map((lesson_id) => ({ lesson_id, passed: true, best_score: 90 })), new Set(credited), placed);
}

function inputs(built: Built, age: AgeEvidence, extra: Partial<CoursePathwayInputs> = {}): CoursePathwayInputs {
  return {
    chapters: built.chapterRows,
    topicKcs: built.topicKcs,
    kcPrerequisites: new Map([['kc.b', ['kc.a']], ['kc.c', ['kc.a']], ['kc.d', ['kc.b']], ['kc.g', ['kc.f']]]),
    age,
    mentorPKnown: new Map(),
    dueReviewKcs: new Set(),
    earnedStages: new Set(),
    placedStages: new Set(),
    hasLegacyPlacement: true,
    ...extra,
  };
}

/** One course with a child, a teen and an adult chapter: the OD-16 target shape. */
const staged = (): Built => buildCourse([
  { slug: 'kids', row: { age_tier: 'tier1' }, sagas: [
    { slug: 's1', topics: [{ slug: 't1', teaches: ['kc.a'] }, { slug: 't2', teaches: ['kc.b'] }] },
    { slug: 's2', topics: [{ slug: 't3', teaches: ['kc.c'] }] },
  ] },
  { slug: 'teens', row: { age_tier: 'tier4', pathway_stage: 'teen', eligibility_min_age: 13, eligibility_max_age: 17 }, sagas: [
    { slug: 's3', topics: [{ slug: 't4', teaches: ['kc.d'] }, { slug: 't5', teaches: ['kc.e'] }] },
  ] },
  { slug: 'adults', row: { age_tier: 'tier4', pathway_stage: 'adult', eligibility_min_age: 18, eligibility_max_age: null }, sagas: [
    { slug: 's4', topics: [{ slug: 't6', teaches: ['kc.f'] }, { slug: 't7', teaches: ['kc.g'] }] },
  ] },
]);

const lessonsOf = (built: Built, chapter: string): string[] => built.lessons.filter((l) => l.topic_id.startsWith(`${chapter}/`)).map((l) => l.id);
const stateOf = (tree: CourseTree, lessonId: string): string | undefined =>
  tree.adventures.flatMap((a) => a.sagas.flatMap((s) => s.topics.flatMap((t) => t.lessons))).find((l) => l.id === lessonId)?.state;

/** Play the pathway one recommended lesson at a time, as a learner would; returns every lesson played. */
function playToCompletion(built: Built, age: AgeEvidence, extra: Partial<CoursePathwayInputs> = {}): { played: string[]; tree: PathwayCourseTree } {
  const played: string[] = [];
  for (let round = 0; round < 5000; round++) {
    const tree = applyCoursePathway(linearTree(built, played), inputs(built, age, extra));
    const next = tree.nextLessonId;
    if (!next) return { played, tree };
    expect(stateOf(tree, next)).toBe('current');
    played.push(next);
  }
  throw new Error('pathway never completed');
}

describe('an adult never has to traverse childhood chapters', () => {
  it('measures an adult on the adult chapter only and awards the adult credential without one child or teen lesson', () => {
    const built = staged();
    const { played, tree } = playToCompletion(built, ageOf(34));
    expect(played.every((id) => id.startsWith('adults/'))).toBe(true);
    expect(tree.pathway).toMatchObject({ learnerStage: 'adult', pathwayStage: 'adult', basis: 'own-stage' });
    expect(tree.course.progress).toEqual({ passed: 4, total: 4, pct: 100 });
    expect(tree.pathway.badge).toMatchObject({ eligible: true, stage: 'adult', contentGap: false });
    expect(pathwayBadgeAward(tree.pathway)).toEqual({ award_key: 'adult', pathway_stage: 'adult', basis: 'own_stage' });
    // Childhood chapters stay playable as optional, never required and never counted.
    const fresh = applyCoursePathway(linearTree(built), inputs(built, ageOf(34)));
    expect(fresh.adventures.map((a) => [a.slug, a.pathwayAccess])).toEqual([['kids', 'optional'], ['teens', 'optional'], ['adults', 'pathway']]);
    expect(fresh.course.progress.total).toBe(4);
    expect(stateOf(fresh, 'kids/s1/t1#1')).toBe('available');
    expect(fresh.pathway.frontier.every((i) => i.access === 'pathway' || i.reason === 'bridge')).toBe(true);
  });

  it("an adult's entry placement walks and credits only adult topics", () => {
    const built = staged();
    const tree = applyCoursePathway(linearTree(built, [], [], false), inputs(built, ageOf(40), { hasLegacyPlacement: false }));
    expect(tree.course.placementRequired).toBe(true);
    const topics = flattenTopicsForPlacement(tree);
    expect(topics.map((t) => t.id)).toEqual(['adults/s4/t6', 'adults/s4/t7']);
  });

  it('a verified-parent Tutor is an adult learner like any other: role never enters the rules', () => {
    const built = staged();
    const tutorAsLearner = applyCoursePathway(linearTree(built), inputs(built, learnerAgeEvidence({ birthDate: null, declaredBand: 'adult', protectedOrigin: false }, NOW)));
    expect(tutorAsLearner.pathway).toMatchObject({ pathwayStage: 'adult', basis: 'own-stage' });
  });
});

describe('a minor never depends on adult chapters', () => {
  it.each([7, 10, 13, 15, 17])('age %i: adult lessons are locked and closed, and the pathway completes without them', (age) => {
    const built = staged();
    const { played, tree } = playToCompletion(built, ageOf(age));
    expect(played.some((id) => id.startsWith('adults/'))).toBe(false);
    expect(tree.pathway.progress.complete).toBe(true);
    expect(tree.pathway.badge.eligible).toBe(true);
    for (const lessonId of lessonsOf(built, 'adults')) {
      expect(stateOf(tree, lessonId)).toBe('locked');
      expect(lessonChapterAccess(tree, lessonId)).toBe('closed');
    }
    expect(tree.adventures.find((a) => a.slug === 'adults')).toMatchObject({ state: 'locked', pathwayAccess: 'closed' });
  });

  it('the under-13 refusal-path guest and a parent-created 7-year-old see only the child pathway; the teen chapter is closed too', () => {
    const built = staged();
    const guest = learnerAgeEvidence({ birthDate: null, declaredBand: 'under_13', protectedOrigin: true }, NOW);
    for (const age of [guest, ageOf(7)]) {
      const tree = applyCoursePathway(linearTree(built), inputs(built, age));
      expect(tree.pathway).toMatchObject({ pathwayStage: 'child', basis: 'own-stage' });
      expect(tree.adventures.map((a) => a.pathwayAccess)).toEqual(['pathway', 'closed', 'closed']);
      expect(tree.course.progress.total).toBe(6);
    }
    // Whatever adult date or band the guest typed, the refusal-path cap (12) keeps teen and adult chapters closed.
    const typedAdult = learnerAgeEvidence({ birthDate: born(30), declaredBand: 'adult', protectedOrigin: true }, NOW);
    const capped = applyCoursePathway(linearTree(built), inputs(built, typedAdult));
    expect(capped.adventures.map((a) => a.pathwayAccess)).toEqual(['pathway', 'closed', 'closed']);
  });

  it("a teen's placement never credits another stage, and a legacy placement counts only for the stage it was made in", () => {
    const built = staged();
    const teen = applyCoursePathway(linearTree(built), inputs(built, ageOf(15), { hasLegacyPlacement: true }));
    // The course's legacy chapters are child chapters: the B.1 row is the child entry, not the teen one (P6).
    expect(legacyCourseStage([...built.chapterRows.values()].map((r) => chapterPolicy(r)))).toBe('child');
    expect(teen.course.placementRequired).toBe(true);
    expect(flattenTopicsForPlacement(teen).map((t) => t.id)).toEqual(['teens/s3/t4', 'teens/s3/t5']);
    const placed = applyCoursePathway(linearTree(built), inputs(built, ageOf(15), { placedStages: new Set<PathwayStage>(['teen']) }));
    expect(placed.course.placementRequired).toBe(false);
    const child = applyCoursePathway(linearTree(built), inputs(built, ageOf(8), { hasLegacyPlacement: true }));
    expect(child.course.placementRequired).toBe(false);
  });
});

describe('a skill mastered with the Mentor never shows locked', () => {
  it('opens a topic whose skills the Mentor holds at its 0.80 bar, even ahead of its saga order', () => {
    const built = staged();
    const cold = applyCoursePathway(linearTree(built), inputs(built, ageOf(8)));
    expect(stateOf(cold, 'kids/s1/t2#1')).toBe('locked');
    expect(stateOf(cold, 'kids/s2/t3#1')).toBe('locked');
    expect(cold.pathway.blocked).toEqual([{ topicId: 'kids/s2/t3', missingSkills: ['kc.a'], missingTopicIds: [] }]);

    const warm = applyCoursePathway(linearTree(built), inputs(built, ageOf(8), { mentorPKnown: new Map([['kc.a', 0.85], ['kc.b', 0.92]]) }));
    expect(stateOf(warm, 'kids/s1/t1#1')).toBe('current');
    expect(stateOf(warm, 'kids/s1/t2#1')).toBe('available'); // kc.b shown with the Mentor
    expect(stateOf(warm, 'kids/s2/t3#1')).toBe('available'); // its prerequisite kc.a shown with the Mentor
    expect(warm.pathway.blocked).toEqual([]);
    expect(warm.pathway.known.map((k) => [k.topicId, k.reason])).toEqual([['kids/s1/t2', 'known']]);
    expect(warm.pathway.skills.filter((s) => s.shown === 'mentor').map((s) => s.key)).toEqual(['kc.a', 'kc.b']);
    // Below the bar is not mastery: 0.79 keeps the prerequisite honest.
    const almost = applyCoursePathway(linearTree(built), inputs(built, ageOf(8), { mentorPKnown: new Map([['kc.a', 0.79]]) }));
    expect(stateOf(almost, 'kids/s2/t3#1')).toBe('locked');
  });

  it('Mentor mastery never completes a topic or earns a badge by itself (B2)', () => {
    const built = staged();
    const all = new Map(['kc.a', 'kc.b', 'kc.c'].map((k) => [k, 0.99]));
    const tree = applyCoursePathway(linearTree(built), inputs(built, ageOf(8), { mentorPKnown: all }));
    expect(tree.pathway.progress).toMatchObject({ passed: 0, complete: false, skillsShown: 3, skillsTaught: 3 });
    expect(tree.pathway.badge.eligible).toBe(false);
  });

  it('seeds the stage-entry placement from graph evidence as a prior only', () => {
    const built = staged();
    const none = applyCoursePathway(linearTree(built), inputs(built, ageOf(8)));
    expect(none.pathway.graphPriorFraction).toBeNull();
    const some = applyCoursePathway(linearTree(built), inputs(built, ageOf(8), { mentorPKnown: new Map([['kc.a', 0.9]]) }));
    expect(some.pathway.graphPriorFraction).toBeCloseTo(1 / 3);
  });
});

describe('no existing credit, XP or badge is lost (OD-9)', () => {
  const single = (): Built => buildCourse([
    { slug: 'a1', row: { age_tier: 'tier1' }, sagas: [{ slug: 's1', topics: [{ slug: 't1', teaches: ['kc.a'] }, { slug: 't2', teaches: ['kc.b'] }] }] },
    { slug: 'a2', row: { age_tier: 'tier2' }, sagas: [{ slug: 's2', topics: [{ slug: 't3', teaches: ['kc.c'] }] }] },
  ]);

  it('keeps every pass and every placement credit passed, and the legacy percentage exactly, for every age', () => {
    const built = single();
    const passed = ['a1/s1/t1#1', 'a1/s1/t1#2', 'a2/s2/t3#2'];
    const credited = ['a1/s1/t2#1'];
    const linear = linearTree(built, passed, credited);
    for (const age of [7, 11, 15, 40]) {
      const tree = applyCoursePathway(linear, inputs(built, ageOf(age)));
      expect(tree.course.progress).toEqual(linear.course.progress);
      for (const id of [...passed, ...credited]) expect(stateOf(tree, id)).toBe('passed');
      const credit = tree.adventures.flatMap((a) => a.sagas.flatMap((s) => s.topics.flatMap((t) => t.lessons))).find((l) => l.id === 'a1/s1/t2#1')!;
      expect(credit.placementCredited).toBe(true);
    }
  });

  it('never demands a held stage twice: the legacy badge makes the stage already earned', () => {
    const built = single();
    const all = built.lessons.map((l) => l.id);
    const tree = applyCoursePathway(linearTree(built, all), inputs(built, ageOf(8), { earnedStages: new Set<PathwayStage>(['child']) }));
    expect(tree.pathway.badge).toMatchObject({ eligible: false, stage: 'child', earnedStages: ['child'] });
    expect(pathwayBadgeAward(tree.pathway)).toBeNull();
  });

  it('keeps passes in a chapter that a corrected, younger age closes (T4): evidence stays, nothing is deleted', () => {
    const built = staged();
    const teenPasses = lessonsOf(built, 'teens');
    const tree = applyCoursePathway(linearTree(built, teenPasses), inputs(built, ageOf(10)));
    expect(tree.adventures.find((a) => a.slug === 'teens')!.pathwayAccess).toBe('closed');
    for (const id of teenPasses) expect(stateOf(tree, id)).toBe('passed');
  });

  it('does not mutate the tree it was given', () => {
    const built = single();
    const linear = linearTree(built);
    const before = JSON.stringify(linear);
    applyCoursePathway(linear, inputs(built, ageOf(8)));
    expect(JSON.stringify(linear)).toBe(before);
  });
});

describe('the course-path projection', () => {
  it('serves only stages and states, with titles for every offered item, and never an age', () => {
    const built = staged();
    const tree = applyCoursePathway(linearTree(built), inputs(built, ageOf(15)));
    const view = projectCoursePath(tree, new Map([['kc.d', { 'en-US': 'Skill D' }]]));
    expect(view.pathway).toMatchObject({ learnerStage: 'teen', pathwayStage: 'teen', basis: 'own-stage', placementRequired: true });
    expect(view.items[0]).toMatchObject({ lessonId: 'teens/s3/t4#1', recommended: true, reason: 'next', access: 'pathway', topicTitle: { 'en-US': 't4' } });
    expect(view.chapters.map((c) => c.access)).toEqual(['optional', 'pathway', 'closed']);
    expect(view.skills[0]).toEqual({ key: 'kc.d', title: { 'en-US': 'Skill D' }, shown: 'none' });
    expect(JSON.stringify(view)).not.toMatch(/birth|"age|lowerBound|upperBound/);
  });
});

// ---------------------------------------------------------------------------
// The real catalog on the real graph (the S05.3a map, as if the drafts were active)
// ---------------------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const seeds = path.resolve(here, '../../../../database/seeds');
const graph = SeedSchema.parse(JSON.parse(readFileSync(path.join(seeds, 'kc_graph.v1.json'), 'utf8')));
const map = KcTopicMapSchema.parse(JSON.parse(readFileSync(path.join(seeds, 'kc_topic_map.v1.json'), 'utf8')));
const tierOf = (course: string, adventureIndex: number): string =>
  course === 'financial-education' ? (adventureIndex < 5 ? 'tier1' : 'tier2') : course === 'first-lemonade-stand' ? 'tier2' : 'tier4';

function realBuilt(course: string): Built & { prerequisites: Map<string, string[]> } {
  const entry = map.courses.find((c) => c.course === course)!;
  const links = deriveTopicKcLinks(map).filter((l) => l.course === course);
  const specs: ChapterSpec[] = [];
  for (const t of entry.topics) {
    const [adv, saga, topic] = t.path.split('/') as [string, string, string];
    let chapter = specs.find((c) => c.slug === adv);
    if (!chapter) {
      chapter = { slug: adv, row: { age_tier: tierOf(course, specs.length) }, sagas: [] };
      specs.push(chapter);
    }
    let s = chapter.sagas.find((x) => x.slug === saga);
    if (!s) { s = { slug: saga, topics: [] }; chapter.sagas.push(s); }
    const own = links.filter((l) => l.topicPath === t.path);
    s.topics.push({
      slug: topic,
      kind: t.kind,
      reviewOf: t.kind === 'teaching' ? [] : t.review_of,
      hard: t.requires ?? [],
      teaches: own.filter((l) => l.role === 'teaches').map((l) => l.kcKey),
      reviews: own.filter((l) => l.role === 'reviews').map((l) => l.kcKey),
    });
  }
  const built = buildCourse(specs);
  const prerequisites = new Map<string, string[]>();
  for (const [from, to] of graph.edges) prerequisites.set(to, [...(prerequisites.get(to) ?? []), from]);
  return { ...built, prerequisites };
}

// Real-catalog simulations walk hundreds of topics; a loaded shared machine can exceed the 5 s default.
describe('the real catalog (S05.3a map activated as if accepted)', () => {
  it.each([['financial-education', 8], ['investing', 15], ['investing', 34], ['entrepreneurship', 12]] as const)(
    '%s at age %i: a learner following the recommendation reaches 100%% and the stage badge, only ever through pathway lessons', (course, age) => {
      const built = realBuilt(course);
      const { played, tree } = playToCompletion(built, ageOf(age), { kcPrerequisites: built.prerequisites });
      expect(tree.pathway.progress.complete).toBe(true);
      expect(tree.course.progress.pct).toBe(100);
      expect(tree.pathway.badge.eligible).toBe(true);
      const pathwayChapters = new Set(tree.adventures.filter((a) => a.pathwayAccess === 'pathway').map((a) => a.slug));
      expect(played.every((id) => pathwayChapters.has(id.split('/')[0]!))).toBe(true);
    }, 60_000);

  it('financial education, age 8, random Mentor mastery: no topic whose skills are all shown is ever locked, and no blocked item names a shown skill', () => {
    const built = realBuilt('financial-education');
    const kcs = [...new Set([...built.topicKcs.values()].flatMap((k) => k.teaches))].sort();
    let seed = 7;
    const random = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let trial = 0; trial < 12; trial++) {
      const mastery = new Map(kcs.filter(() => random() < 0.35).map((k) => [k, 0.8 + random() * 0.2]));
      const passed = built.lessons.filter(() => random() < 0.15).map((l) => l.id);
      const tree = applyCoursePathway(linearTree(built, passed), inputs(built, ageOf(8), { kcPrerequisites: built.prerequisites, mentorPKnown: mastery }));
      const shown = new Set(tree.pathway.skills.filter((s) => s.shown !== 'none').map((s) => s.key));
      for (const kc of mastery.keys()) if (tree.pathway.skills.some((s) => s.key === kc)) expect(shown.has(kc)).toBe(true);
      for (const adventure of tree.adventures) {
        for (const saga of adventure.sagas) {
          for (const topic of saga.topics) {
            const teaches = built.topicKcs.get(topic.id)?.teaches ?? [];
            const firstOpen = topic.lessons.find((l) => l.state !== 'passed');
            if (firstOpen && teaches.length > 0 && teaches.every((k) => shown.has(k))) expect(firstOpen.state, topic.id).not.toBe('locked');
          }
        }
      }
      for (const blocked of tree.pathway.blocked) for (const kc of blocked.missingSkills) expect(shown.has(kc)).toBe(false);
    }
  }, 60_000);
});
