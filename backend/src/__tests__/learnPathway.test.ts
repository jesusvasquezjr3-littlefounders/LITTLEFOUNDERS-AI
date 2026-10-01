import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb, type FakeRow } from './fakePostgrest.js';

/*
 * B.6 / S05.3b at the HTTP boundary: the learner routes on the pathway engine
 * (COURSE_PATHWAY_ENGINE=pathway), attacked with direct API requests from
 * every population. The UI never substitutes for any of these decisions.
 *
 * Populations: a parent-created 7-year-old, the under-13 refusal-path guest,
 * a 12-year-old, an independent teen of 15, an adult, and a verified-parent
 * Tutor learning for themselves. Their age evidence is server-side only.
 *
 * Catalog (the OD-16 target shape next to today's legacy shape):
 *   money      one course with a child (legacy tier1), a teen and an adult chapter
 *   fe         a children's course (tier1), like financial education today
 *   entre      a 12–18 course (tier4), like entrepreneurship today
 *   investing  a 12–18 course that requires fe and entre, like investing today
 */

const uid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const yearsAgo = (years: number): string => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
};

const KID7 = uid(101);
const GUEST = uid(102);
const TEEN15 = uid(103);
const AGE12 = uid(104);
const ADULT = uid(105);
const TUTOR = uid(106);

const COURSE = { money: uid(1), fe: uid(2), entre: uid(3), investing: uid(4) };

interface Built { db: FakeDb; lesson: Record<string, string>; topic: Record<string, string> }

function storyDocument(slug: string, lessonId: string, courseId: string, chapterId: string) {
  return {
    schema_version: 2, course_id: courseId, pathway_id: 'test-pathway', chapter_id: chapterId,
    lesson_id: lessonId, version_id: 'revision-001', locale: 'en-US', age_band: 'adult',
    eligibility: { minimum_age: 6, maximum_age: 119 }, knowledge_component_ids: ['test-skill'],
    adventure_scene_id: 'diorama-a', title: slug,
    required_capabilities: ['visual.speech-plate.v1'],
    segments: [{ id: 'story', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Story',
      visual: { type: 'speech-plate' }, payload: { role: 'intro', line: 'The end.' } }],
  };
}

function build(): Built {
  const db: FakeDb = {
    courses: [], adventures: [], sagas: [], topics: [], lessons: [], lesson_documents: [],
    kc: [], kc_edge: [], topic_knowledge_components: [], learner_kc_mastery: [], memory_card: [],
    course_pathway_badges: [], course_pathway_placements: [], course_placements: [], placement_credits: [],
    lesson_progress: [], lesson_segment_attempts: [], completed_course_badges: [],
    account_age_declarations: [
      { user_id: KID7, declared_age_band: 'under_13' },
      { user_id: TEEN15, declared_age_band: '13_to_17' },
      { user_id: AGE12, declared_age_band: 'under_13' },
      { user_id: ADULT, declared_age_band: 'adult' },
      { user_id: TUTOR, declared_age_band: 'adult' },
    ],
    account_safety_origins: [{ user_id: GUEST, under13_origin: true }],
    profiles: [
      { user_id: KID7, display_name: 'Kid', locale: 'en-US', birth_date: yearsAgo(7) },
      { user_id: GUEST, display_name: 'Guest', locale: 'en-US', birth_date: null },
      { user_id: TEEN15, display_name: 'Teen', locale: 'en-US', birth_date: yearsAgo(15) },
      { user_id: AGE12, display_name: 'Twelve', locale: 'en-US', birth_date: yearsAgo(12) },
      { user_id: ADULT, display_name: 'Adult', locale: 'en-US', birth_date: yearsAgo(30) },
      { user_id: TUTOR, display_name: 'Tutor', locale: 'en-US', birth_date: '1985-05-05' },
    ],
    learning_stats: [KID7, GUEST, TEEN15, AGE12, ADULT, TUTOR].map((user_id) => ({
      user_id, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null,
    })),
    user_roles: [{ user_id: TUTOR, role: 'parent' }],
    parent_verifications: [{ user_id: TUTOR, status: 'verified', method: 'local-ocr', birth_date: '1985-05-05' }],
    guardian_links: [{ parent_user_id: TUTOR, kid_user_id: KID7, verification_status: 'verified' }],
  };
  const lesson: Record<string, string> = {};
  const topic: Record<string, string> = {};
  let n = 1000;
  const addCourse = (slug: keyof typeof COURSE, requires: string[], chapters: Array<{ slug: string; tier: string; explicit?: [string, number, number | null]; topics: string[] }>) => {
    db.courses!.push({ id: COURSE[slug], slug, title: { 'en-US': slug }, description: {}, subject: 'money', badge_asset: `${slug}.png`, status: 'published', position: db.courses!.length + 1, requires });
    chapters.forEach((chapter, ci) => {
      const adventureId = uid(++n);
      db.adventures!.push({
        id: adventureId, course_id: COURSE[slug], position: ci + 1, slug: chapter.slug, title: { 'en-US': chapter.slug }, description: {}, theme: 't', status: 'published',
        age_tier: chapter.tier, pathway_stage: chapter.explicit?.[0] ?? null, eligibility_min_age: chapter.explicit?.[1] ?? null, eligibility_max_age: chapter.explicit?.[2] ?? null,
      });
      const sagaId = uid(++n);
      db.sagas!.push({ id: sagaId, adventure_id: adventureId, position: 1, slug: 's', title: {}, icon: 'x', status: 'published' });
      chapter.topics.forEach((key, ti) => {
        const topicId = uid(++n);
        topic[key] = topicId;
        db.topics!.push({ id: topicId, saga_id: sagaId, position: ti + 1, slug: key, title: { 'en-US': key }, status: 'published', kind: 'teaching', review_of: [], prerequisites: [],
          placement_probe: { 'en-US': { prompt: `Probe ${key}`, options: ['right', 'wrong'], correctIndex: 0 } } });
        const kcId = uid(++n);
        db.kc!.push({ id: kcId, key: `kc.${key}`, strand: 'money_life', title: { 'en-US': `Skill ${key}` }, objective: {}, tier_min: 1, p_l0: 0.2, p_t: 0.1, p_g: 0.2, p_s: 0.1, skill_key: null, status: 'active' });
        db.topic_knowledge_components!.push({ topic_id: topicId, kc_id: kcId, role: 'teaches', is_primary: true, map_version: 1 });
        const lessonId = uid(++n);
        lesson[key] = lessonId;
        db.lessons!.push({ id: lessonId, topic_id: topicId, position: 1, slug: key, title: { 'en-US': key }, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' });
        const versionId = uid(++n);
        (db.lesson_document_versions ??= []).push({ id: versionId, lesson_id: lessonId, locale: 'en-US', version_id: 'revision-001', schema_version: 2,
          document: storyDocument(key, lessonId, COURSE[slug], adventureId), answer_keys: {}, audio: {}, created_at: '2026-09-01T00:00:00.000Z' });
        (db.lesson_document_version_current ??= []).push({ lesson_id: lessonId, locale: 'en-US', document_version_id: versionId });
      });
    });
  };
  addCourse('money', [], [
    { slug: 'kids', tier: 'tier1', topics: ['k1', 'k2'] },
    { slug: 'teens', tier: 'tier4', explicit: ['teen', 13, 17], topics: ['t1', 't2'] },
    { slug: 'adults', tier: 'tier4', explicit: ['adult', 18, null], topics: ['a1', 'a2'] },
  ]);
  addCourse('fe', [], [{ slug: 'fe-kids', tier: 'tier1', topics: ['f1'] }]);
  addCourse('entre', [], [{ slug: 'entre-teens', tier: 'tier4', topics: ['e1'] }]);
  addCourse('investing', ['fe', 'entre'], [{ slug: 'inv-teens', tier: 'tier4', topics: ['i1'] }]);
  return { db, lesson, topic };
}

let built: Built;
const place = (user: string, course: keyof typeof COURSE, stage: string) =>
  built.db.course_pathway_placements!.push({ user_id: user, course_id: COURSE[course], pathway_stage: stage, method: 'learner_chose_start', start_topic_id: null, credited_topics: 0 });
const as = (user: string) => (req: request.Test) => req.set('Authorization', `Bearer ${mintToken({ sub: user })}`);
const get = (user: string, path: string) => as(user)(request(createApp()).get(`/api/v1${path}`));
const rawPost = (user: string, path: string, body: object = {}) => as(user)(request(createApp()).post(`/api/v1${path}`).send(body));
const post = async (user: string, path: string, body: object = {}) => {
  if (path.endsWith('/complete')) {
    const lessonPath = path.slice(0, -'/complete'.length);
    const started = await rawPost(user, `${lessonPath}/v2-runs`);
    if (started.status !== 200) return started;
    const viewed = await rawPost(user, `${lessonPath}/v2-runs/${started.body.data.run_id}/views`, { segment_id: 'story' });
    if (viewed.status !== 200) return viewed;
    return rawPost(user, path, { ...body, run_id: started.body.data.run_id });
  }
  return rawPost(user, path, body);
};
const stateOf = (tree: { adventures: Array<{ sagas: Array<{ topics: Array<{ lessons: Array<{ id: string; state: string }> }> }> }> }, lessonId: string) =>
  tree.adventures.flatMap((a) => a.sagas.flatMap((s) => s.topics.flatMap((t) => t.lessons))).find((l) => l.id === lessonId)?.state;

beforeEach(() => {
  process.env.COURSE_PATHWAY_ENGINE = 'pathway';
  resetConfigForTests();
  built = build();
  vi.stubGlobal('fetch', createFakeFetch(built.db));
});

afterEach(() => {
  delete process.env.COURSE_PATHWAY_ENGINE;
  resetConfigForTests();
  vi.unstubAllGlobals();
});

describe('the release switch (OD-22)', () => {
  it('keeps the linear engine by default and refuses the course path until an operator switches it on', async () => {
    delete process.env.COURSE_PATHWAY_ENGINE;
    resetConfigForTests();
    built.db.course_placements!.push({ user_id: TEEN15, course_id: COURSE.money });
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(tree.status).toBe(200);
    expect(tree.body.data.pathway).toBeUndefined();
    // Linear: one flat order, the adult chapter's lessons merely "later", never age-closed.
    expect(stateOf(tree.body.data, built.lesson.k1!)).toBe('current');
    expect((await get(TEEN15, '/learn/courses/money/path')).body.error.code).toBe('PATHWAY_ENGINE_DISABLED');
  });
});

describe('a minor never depends on adult chapters', () => {
  it.each([['parent-created 7-year-old', KID7], ['refusal-path guest', GUEST]])('%s: the child pathway only; teen and adult lessons are age-restricted on every endpoint', async (_label, user) => {
    place(user, 'money', 'child');
    const tree = await get(user, '/learn/courses/money/tree');
    expect(tree.status, JSON.stringify(tree.body)).toBe(200);
    expect(tree.body.data.pathway).toMatchObject({ learnerStage: 'child', pathwayStage: 'child', basis: 'own-stage' });
    expect(tree.body.data.adventures.map((a: { pathwayAccess: string }) => a.pathwayAccess)).toEqual(['pathway', 'closed', 'closed']);
    expect(tree.body.data.course.progress.total).toBe(2);
    for (const key of ['t1', 'a1']) {
      const lessonId = built.lesson[key]!;
      expect((await get(user, `/learn/lessons/${lessonId}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');
      const complete = await post(user, `/learn/lessons/${lessonId}/complete`, { minutes_spent: 1 });
      expect(complete.status).toBe(403);
      expect(complete.body.error.code).toBe('LESSON_AGE_RESTRICTED');
    }
    expect(built.db.lesson_progress).toEqual([]);
    // A teen-only course is closed before anything else is decided, placement included.
    expect((await get(user, '/learn/courses/investing/tree')).body.error.code).toBe('COURSE_AGE_RESTRICTED');
    expect((await post(user, '/placement/investing/step', {})).body.error.code).toBe('COURSE_AGE_RESTRICTED');
    expect((await post(user, '/placement/investing/commit', { startFromBeginning: true })).body.error.code).toBe('COURSE_AGE_RESTRICTED');
    expect(built.db.course_pathway_placements!.some((row) => row.course_id === COURSE.investing)).toBe(false);
  });

  it('an independent teen completes the teen pathway and earns the teen credential without one adult lesson; adult lessons stay closed', async () => {
    place(TEEN15, 'money', 'teen');
    for (const key of ['t1', 't2']) {
      const res = await post(TEEN15, `/learn/lessons/${built.lesson[key]}/complete`, { minutes_spent: 1 });
      expect(res.status, key).toBe(200);
    }
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(tree.body.data.pathway).toMatchObject({ pathwayStage: 'teen', progress: { complete: true, pct: 100 } });
    expect(tree.body.data.course.progress).toEqual({ passed: 2, total: 2, pct: 100 });
    expect(built.db.course_pathway_badges).toEqual([
      expect.objectContaining({ user_id: TEEN15, course_id: COURSE.money, award_key: 'teen', pathway_stage: 'teen', basis: 'own_stage' }),
    ]);
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.a1}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');
    // The childhood chapter is optional: playable, never counted.
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.k1}`)).status).toBe(200);
  });
});

describe('an adult never has to traverse childhood chapters', () => {
  it.each([['adult', ADULT], ['verified-parent Tutor learning for themselves', TUTOR]])('%s: the adult chapter is the pathway, placed and completed with no child or teen lesson', async (_label, user) => {
    // No placement yet: the adult stage needs its own entry placement (P6).
    expect((await get(user, `/learn/lessons/${built.lesson.a1}`)).body.error.code).toBe('PLACEMENT_REQUIRED');
    const commit = await post(user, '/placement/money/commit', { startFromBeginning: true });
    expect(commit.status).toBe(201);
    expect(built.db.course_pathway_placements).toContainEqual(expect.objectContaining({ user_id: user, course_id: COURSE.money, pathway_stage: 'adult' }));
    for (const key of ['a1', 'a2']) expect((await post(user, `/learn/lessons/${built.lesson[key]}/complete`, { minutes_spent: 1 })).status).toBe(200);
    const tree = await get(user, '/learn/courses/money/tree');
    expect(tree.body.data.pathway).toMatchObject({ learnerStage: 'adult', pathwayStage: 'adult', basis: 'own-stage', progress: { complete: true } });
    expect(tree.body.data.adventures.map((a: { pathwayAccess: string }) => a.pathwayAccess)).toEqual(['optional', 'optional', 'pathway']);
    expect(built.db.lesson_progress!.map((row) => row.lesson_id).sort()).toEqual([built.lesson.a1, built.lesson.a2].sort());
    expect(built.db.course_pathway_badges).toContainEqual(expect.objectContaining({ user_id: user, award_key: 'adult', basis: 'own_stage' }));
  });

  it("an adult's placement answers can only credit adult topics, and a quiz over the adult pathway credits them", async () => {
    const step = await post(ADULT, '/placement/money/step', {});
    expect(step.status).toBe(200);
    expect([built.topic.a1, built.topic.a2]).toContain(step.body.data.probe.topicId);
    // A crafted request answering CHILD probes earns nothing: those topics are not in the adult pathway.
    const answers = [built.topic.k1, built.topic.k2, built.topic.a1, built.topic.a2].map((topicId) => ({ topicId, selectedIndex: 0 }));
    const commit = await post(ADULT, '/placement/money/commit', { answers });
    expect(commit.status).toBe(201);
    const credited = built.db.placement_credits!.filter((row) => row.user_id === ADULT).map((row) => row.lesson_id);
    expect(credited.length).toBeGreaterThan(0);
    expect(credited.every((id) => id === built.lesson.a1 || id === built.lesson.a2)).toBe(true);
  });

  it('course prerequisites across stages (P7): an adult enters investing without the children\'s course or the 12–18 course', async () => {
    place(ADULT, 'investing', 'teen');
    const res = await get(ADULT, '/learn/courses/investing/tree');
    expect(res.status).toBe(200);
    expect(res.body.data.pathway).toMatchObject({ learnerStage: 'adult', pathwayStage: 'teen', basis: 'younger-bridge' });
  });
});

describe('course prerequisites for minors (P7)', () => {
  it('a teen is waived the children\'s course but still needs the own-stage course; its badge from any stage satisfies it', async () => {
    place(TEEN15, 'investing', 'teen');
    const refused = await get(TEEN15, '/learn/courses/investing/tree');
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: 'COURSE_PREREQUISITE_REQUIRED', missingPrerequisites: ['entre'] });
    built.db.course_pathway_badges!.push({ user_id: TEEN15, course_id: COURSE.entre, award_key: 'legacy', pathway_stage: null, basis: 'legacy_full_course', earned_at: '2026-01-01T00:00:00Z' });
    expect((await get(TEEN15, '/learn/courses/investing/tree')).status).toBe(200);
  });

  it('a 12-year-old enters the 12–18 course early and so still needs the 12–18 prerequisite; the children\'s course is waived', async () => {
    const refused = await get(AGE12, '/learn/courses/investing/tree');
    expect(refused.status).toBe(409);
    expect(refused.body.error.missingPrerequisites).toEqual(['entre']);
  });
});

describe('a skill mastered with the Mentor never shows locked', () => {
  it('opens the teen topic whose skill the Mentor holds at 0.80, on the tree and at the lesson gate', async () => {
    place(TEEN15, 'money', 'teen');
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.t2}`)).body.error.code).toBe('LESSON_LOCKED');
    const kc = built.db.kc!.find((row) => row.key === 'kc.t2')!;
    built.db.learner_kc_mastery!.push({ user_id: TEEN15, kc_id: kc.id, p_known: 0.86, attempts: 6, correct: 5, params_override: null });
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(stateOf(tree.body.data, built.lesson.t2!)).toBe('available');
    expect(tree.body.data.pathway.skills).toContainEqual({ key: 'kc.t2', shown: 'mentor' });
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.t2}`)).status).toBe(200);
  });

  it('ignores draft KCs exactly as the Mentor does', async () => {
    place(TEEN15, 'money', 'teen');
    const kc = built.db.kc!.find((row) => row.key === 'kc.t2')!;
    kc.status = 'draft';
    built.db.learner_kc_mastery!.push({ user_id: TEEN15, kc_id: kc.id, p_known: 0.99, attempts: 6, correct: 6, params_override: null });
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(stateOf(tree.body.data, built.lesson.t2!)).toBe('locked');
    expect(tree.body.data.pathway.skills.map((s: { key: string }) => s.key)).toEqual(['kc.t1']);
  });

  it('fails closed with 502 when the Mentor mastery cannot be read, never re-locking as if nothing were known', async () => {
    place(TEEN15, 'money', 'teen');
    const inner = createFakeFetch(built.db);
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/learner_kc_mastery') ? new Response('{}', { status: 503 }) : inner(input, init)) as typeof fetch);
    expect((await get(TEEN15, '/learn/courses/money/tree')).status).toBe(502);
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.t1}`)).status).toBe(502);
  });
});

describe('OD-24: a skill completed on the legacy catalog starts the new course at the right place', () => {
  const credit = (user: string, key: string, stage = 'teen') => {
    const kc = built.db.kc!.find((row) => row.key === key)!;
    built.db.legacy_kc_credits = [...(built.db.legacy_kc_credits ?? []), {
      user_id: user, kc_id: kc.id, source_topic_id: uid(9001), source_course_slug: 'legacy-course', source_topic_path: 'a/s/t',
      source_stage: stage, basis: 'lessons_passed', lessons_total: 2, completed_at: '2026-05-05T00:00:00.000Z', map_version: 1,
    }];
    return kc;
  };

  it('opens the topic whose skill a completed legacy topic taught, as course evidence, on the tree and at the lesson gate, without completing it', async () => {
    place(TEEN15, 'money', 'teen');
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.t2}`)).body.error.code).toBe('LESSON_LOCKED');
    credit(TEEN15, 'kc.t2');
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(stateOf(tree.body.data, built.lesson.t2!)).toBe('available');
    expect(tree.body.data.pathway.skills).toContainEqual({ key: 'kc.t2', shown: 'course' });
    expect(tree.body.data.pathway.progress).toMatchObject({ passed: 0, complete: false });
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.t2}`)).status).toBe(200);
  });

  it('never lends one learner\'s legacy credit to another, and ignores a draft KC as the Mentor does', async () => {
    place(TEEN15, 'money', 'teen');
    credit(KID7, 'kc.t2', 'child');
    const kc = credit(TEEN15, 'kc.t2');
    kc.status = 'draft';
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(stateOf(tree.body.data, built.lesson.t2!)).toBe('locked');
  });

  it('fails closed with 502 when the legacy credits cannot be read, never re-locking as if nothing were completed', async () => {
    place(TEEN15, 'money', 'teen');
    const inner = createFakeFetch(built.db);
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/legacy_kc_credits') ? new Response('{}', { status: 503 }) : inner(input, init)) as typeof fetch);
    expect((await get(TEEN15, '/learn/courses/money/tree')).status).toBe(502);
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.t1}`)).status).toBe(502);
  });
});

describe('no existing credit, XP or badge is lost (OD-9)', () => {
  it('a learner with the live legacy badge keeps it, frozen, dated when earned, and is never asked to earn the stage again', async () => {
    built.db.lesson_progress!.push({ user_id: KID7, lesson_id: built.lesson.f1, passed: true, best_score: 100, xp_earned: 10 });
    built.db.completed_course_badges!.push({ user_id: KID7, course_slug: 'fe', course_title: { 'en-US': 'fe' }, badge_asset: 'fe.png', completed_at: '2026-03-03T00:00:00.000Z' });
    built.db.course_placements!.push({ user_id: KID7, course_id: COURSE.fe });
    const tree = await get(KID7, '/learn/courses/fe/tree');
    expect(tree.status).toBe(200);
    expect(tree.body.data.pathway.badge).toMatchObject({ earnedStages: ['child'], eligible: false });
    expect(built.db.course_pathway_badges).toEqual([
      expect.objectContaining({ user_id: KID7, course_id: COURSE.fe, award_key: 'legacy', pathway_stage: 'child', basis: 'legacy_full_course', earned_at: '2026-03-03T00:00:00.000Z' }),
    ]);
    // The B.1 legacy placement is the child entry placement: no second placement is demanded.
    expect(tree.body.data.course.placementRequired).toBe(false);
    await get(KID7, '/learn/courses/fe/tree');
    expect(built.db.course_pathway_badges).toHaveLength(1);
  });

  it('keeps earlier-stage placement credits and passes when a learner places again for a new stage', async () => {
    built.db.course_placements!.push({ user_id: TEEN15, course_id: COURSE.money });
    built.db.placement_credits!.push({ user_id: TEEN15, course_id: COURSE.money, lesson_id: built.lesson.k1, topic_id: built.topic.k1 });
    built.db.lesson_progress!.push({ user_id: TEEN15, lesson_id: built.lesson.k2, passed: true, best_score: 80, xp_earned: 10 });
    const before = await get(TEEN15, '/learn/courses/money/tree');
    expect(before.body.data.course.placementRequired).toBe(true); // the legacy row is the CHILD entry
    expect(stateOf(before.body.data, built.lesson.k1!)).toBe('passed');
    expect((await post(TEEN15, '/placement/money/commit', { startFromBeginning: true })).status).toBe(201);
    const after = await get(TEEN15, '/learn/courses/money/tree');
    expect(after.body.data.course.placementRequired).toBe(false);
    expect(stateOf(after.body.data, built.lesson.k1!)).toBe('passed');
    expect(stateOf(after.body.data, built.lesson.k2!)).toBe('passed');
    expect(built.db.placement_credits).toContainEqual(expect.objectContaining({ user_id: TEEN15, lesson_id: built.lesson.k1 }));
    expect(built.db.course_placements!.filter((row) => row.user_id === TEEN15)).toHaveLength(1);
  });

  it('replaying the last lesson of a completed pathway neither duplicates the badge nor changes XP arithmetic', async () => {
    place(TEEN15, 'money', 'teen');
    for (const key of ['t1', 't2']) await post(TEEN15, `/learn/lessons/${built.lesson[key]}/complete`, { minutes_spent: 1 });
    const xpBefore = built.db.learning_stats!.find((row) => row.user_id === TEEN15)!.xp_points;
    await post(TEEN15, `/learn/lessons/${built.lesson.t2}/complete`, { minutes_spent: 1 });
    expect(built.db.course_pathway_badges!.filter((row) => row.user_id === TEEN15)).toHaveLength(1);
    expect(built.db.learning_stats!.find((row) => row.user_id === TEEN15)!.xp_points).toBe(xpBefore);
  });
});

describe('the shelf, the course path and the guardian view', () => {
  it('lists every course with the learner stage and marks the age-closed one, instead of hiding it', async () => {
    const res = await get(KID7, '/learn/courses');
    expect(res.status).toBe(200);
    const bySlug = Object.fromEntries(res.body.data.courses.map((c: { slug: string; pathway: unknown }) => [c.slug, c.pathway]));
    expect(bySlug.money).toMatchObject({ learnerStage: 'child', basis: 'own-stage' });
    expect(bySlug.investing).toMatchObject({ basis: 'unavailable', pathwayStage: null });
  });

  it('serves the course path with titles, the recommendation first, and no age', async () => {
    place(TEEN15, 'money', 'teen');
    const res = await get(TEEN15, '/learn/courses/money/path');
    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toMatchObject({ lessonId: built.lesson.t1, recommended: true, reason: 'next', access: 'pathway', topicTitle: { 'en-US': 't1' } });
    expect(res.body.data.chapters.map((c: { access: string }) => c.access)).toEqual(['optional', 'pathway', 'closed']);
    expect(res.body.data.skills).toEqual([
      { key: 'kc.t1', title: { 'en-US': 'Skill t1' }, shown: 'none' },
      { key: 'kc.t2', title: { 'en-US': 'Skill t2' }, shown: 'none' },
    ]);
    expect(JSON.stringify(res.body.data)).not.toMatch(/birth|"age|lowerBound/);
    expect((await get(KID7, '/learn/courses/investing/path')).body.error.code).toBe('COURSE_AGE_RESTRICTED');
  });

  it("a verified guardian sees the kid's own pathway (the kid's age, not the parent's)", async () => {
    const res = await get(TUTOR, `/family/kids/${KID7}/courses/money/territory`);
    expect(res.status).toBe(200);
    expect(res.body.data.tree.pathway).toMatchObject({ learnerStage: 'child', pathwayStage: 'child' });
    expect(res.body.data.tree.adventures.map((a: { pathwayAccess: string }) => a.pathwayAccess)).toEqual(['pathway', 'closed', 'closed']);
  });
});

describe('B.24 path choice (S05.3e): opening a lesson from a path with a real choice', () => {
  async function pathChoices(wait = 40): Promise<FakeRow[]> {
    for (let i = 0; i < wait; i += 1) {
      await new Promise((done) => setTimeout(done, 5));
      const rows = (built.db.learning_events ?? []).filter((row) => row.event === 'path_choice');
      if (rows.length) return rows;
    }
    return [];
  }

  it('records the recommendation as 0 and another frontier lesson as 1, once per lesson and day, for a consenting teen', async () => {
    place(TEEN15, 'money', 'teen');
    built.db.user_roles!.push({ user_id: TEEN15, role: 'universal' });
    built.db.teen_analytics_preferences = [{ user_id: TEEN15, enabled: true, disclosure_version: 1 }];
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.t1}`)).status).toBe(200);
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.k1}`)).status).toBe(200);
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.k1}`)).status).toBe(200); // a reload is the same choice
    await pathChoices();
    await new Promise((done) => setTimeout(done, 40));
    const rows = (built.db.learning_events ?? []).filter((row) => row.event === 'path_choice');
    expect(rows.map((row) => [row.lesson_id, row.value]).sort()).toEqual([[built.lesson.k1, 1], [built.lesson.t1, 0]].sort());
    expect(rows.every((row) => row.user_id === TEEN15 && row.route_class === 'learn')).toBe(true);
  });

  it('records nothing for a teen who opted out of analytics', async () => {
    place(TEEN15, 'money', 'teen');
    built.db.user_roles!.push({ user_id: TEEN15, role: 'universal' });
    built.db.teen_analytics_preferences = [{ user_id: TEEN15, enabled: false, disclosure_version: 1 }];
    expect((await get(TEEN15, `/learn/lessons/${built.lesson.k1}`)).status).toBe(200);
    await new Promise((done) => setTimeout(done, 60));
    expect((built.db.learning_events ?? []).filter((row) => row.event === 'path_choice')).toEqual([]);
  });
});

// Keep the fake's row type honest for the fixture helpers above.
export type { FakeRow };

describe('OD-25 — mastery may open one stage early, and Mentor mastery may complete a topic with the learner\'s consent', () => {
  const kcId = (key: string) => built.db.kc!.find((row) => row.key === key)!.id as string;
  const master = (user: string, key: string, p = 0.9) =>
    built.db.learner_kc_mastery!.push({ user_id: user, kc_id: kcId(key), p_known: p, attempts: 6, correct: 5, params_override: null });
  const chapterId = (slug: string) => built.db.adventures!.find((row) => row.slug === slug)!.id as string;
  // The teen chapter's skills build on the first children's skill; the adult chapter's on the teen ones.
  const edges = () => {
    built.db.kc_edge!.push({ prerequisite_kc_id: kcId('kc.k1'), dependent_kc_id: kcId('kc.t1') });
    built.db.kc_edge!.push({ prerequisite_kc_id: kcId('kc.t1'), dependent_kc_id: kcId('kc.a1') });
  };

  it('a 12-year-old who mastered the teen chapter\'s prerequisites may open it after confirming; it plays as an extra', async () => {
    edges();
    place(AGE12, 'money', 'child');
    const before = await get(AGE12, '/learn/courses/money/path');
    expect(before.body.data.earlyAccess).toEqual([]);
    expect((await post(AGE12, '/learn/courses/money/early-access', { chapterId: chapterId('teens') })).status).toBe(409);
    master(AGE12, 'kc.k1');
    const path = await get(AGE12, '/learn/courses/money/path');
    expect(path.body.data.earlyAccess).toEqual([expect.objectContaining({ chapterId: chapterId('teens'), stage: 'teen', state: 'eligible',
      prerequisiteSkills: [expect.objectContaining({ key: 'kc.k1' })] })]);
    // Nothing opens before the learner confirms.
    expect((await get(AGE12, `/learn/lessons/${built.lesson.t1}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');
    const opened = await post(AGE12, '/learn/courses/money/early-access', { chapterId: chapterId('teens') });
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    expect(opened.body.data).toEqual({ status: 'opened', replayed: false });
    expect(built.db.course_chapter_early_access).toEqual([expect.objectContaining({ user_id: AGE12, adventure_id: chapterId('teens'), pathway_stage: 'teen', prerequisite_kcs: ['kc.k1'] })]);
    expect(built.db.audit_logs).toEqual(expect.arrayContaining([expect.objectContaining({ actor_id: AGE12, action: 'learning_pathway.early_chapter_opened' })]));
    const after = await get(AGE12, '/learn/courses/money/path');
    expect(after.body.data.chapters.find((c: { id: string }) => c.id === chapterId('teens')).access).toBe('optional');
    expect(after.body.data.earlyAccess[0].state).toBe('opened');
    // Never counted: the progress denominator is still the child pathway.
    expect(after.body.data.pathway.progress.total).toBe(before.body.data.pathway.progress.total);
    expect((await get(AGE12, `/learn/lessons/${built.lesson.t1}`)).status).toBe(200);
    expect((await post(AGE12, '/learn/courses/money/early-access', { chapterId: chapterId('teens') })).body.data.replayed).toBe(true);
  });

  it('never two stages up, never an adult chapter for a minor, never on an unknown age', async () => {
    edges();
    for (const key of ['kc.k1', 'kc.k2', 'kc.t1', 'kc.t2']) { master(KID7, key); master(TEEN15, key); master(GUEST, key); }
    place(KID7, 'money', 'child');
    place(TEEN15, 'money', 'teen');
    expect((await get(KID7, '/learn/courses/money/path')).body.data.earlyAccess).toEqual([]);
    expect((await post(KID7, '/learn/courses/money/early-access', { chapterId: chapterId('teens') })).status).toBe(409);
    expect((await get(TEEN15, '/learn/courses/money/path')).body.data.earlyAccess).toEqual([]);
    expect((await post(TEEN15, '/learn/courses/money/early-access', { chapterId: chapterId('adults') })).status).toBe(409);
    expect((await post(GUEST, '/learn/courses/money/early-access', { chapterId: chapterId('teens') })).status).not.toBe(200);
    expect(built.db.course_chapter_early_access ?? []).toEqual([]);
    expect((await post(AGE12, '/learn/courses/money/early-access', { chapterId: 'not-a-uuid' })).status).toBe(400);
  });

  it('a topic shown with the Mentor counts as done only after the learner accepts, as a credit; a finished pathway earns its badge', async () => {
    place(TEEN15, 'money', 'teen');
    master(TEEN15, 'kc.t1');
    const path = await get(TEEN15, '/learn/courses/money/path');
    expect(path.body.data.masteryOffers).toEqual([expect.objectContaining({ topicId: built.topic.t1, skills: [expect.objectContaining({ key: 'kc.t1' })] })]);
    // Before accepting, nothing is counted.
    expect(path.body.data.pathway.progress.passed).toBe(0);
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t2 })).status).toBe(409);
    const accepted = await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1 });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(built.db.course_topic_mastery_credits).toEqual([expect.objectContaining({ user_id: TEEN15, topic_id: built.topic.t1, kc_keys: ['kc.t1'], p_known: { 'kc.t1': 0.9 } })]);
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(stateOf(tree.body.data, built.lesson.t1!)).toBe('passed');
    expect(tree.body.data.pathway.progress.passed).toBe(1);
    expect(tree.body.data.pathway.masteryCredited).toEqual([built.topic.t1]);
    // Credited, never played: no lesson_progress row and no XP.
    expect((built.db.lesson_progress ?? []).filter((row) => row.user_id === TEEN15)).toEqual([]);
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1 })).body.data.replayed).toBe(true);
    master(TEEN15, 'kc.t2');
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t2 })).status).toBe(200);
    expect(built.db.course_pathway_badges).toEqual([expect.objectContaining({ user_id: TEEN15, course_id: COURSE.money, award_key: 'teen', pathway_stage: 'teen' })]);
  });

  it('W3L.1: a declined Mentor-mastery offer is remembered, never asked again, and the first answer is final', async () => {
    place(TEEN15, 'money', 'teen');
    master(TEEN15, 'kc.t1');
    master(TEEN15, 'kc.t2');
    // Nothing to decline that the pathway does not offer, and a bad decision is a 400.
    expect((await post(KID7, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1, decision: 'decline' })).status).toBe(409);
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1, decision: 'maybe' })).status).toBe(400);
    const declined = await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1, decision: 'decline' });
    expect(declined.status, JSON.stringify(declined.body)).toBe(200);
    expect(declined.body.data).toEqual({ status: 'declined', replayed: false });
    expect(built.db.course_topic_mastery_declines).toEqual([expect.objectContaining({ user_id: TEEN15, topic_id: built.topic.t1, kc_keys: ['kc.t1'] })]);
    expect(built.db.course_topic_mastery_credits ?? []).toEqual([]);
    expect(built.db.audit_logs).toEqual(expect.arrayContaining([expect.objectContaining({ actor_id: TEEN15, action: 'learning_pathway.mastery_credit_declined' })]));
    // Never offered again; nothing counted; the other topic's offer stands.
    const path = await get(TEEN15, '/learn/courses/money/path');
    expect(path.body.data.masteryOffers.map((o: { topicId: string }) => o.topicId)).toEqual([built.topic.t2]);
    expect(path.body.data.pathway.progress.passed).toBe(0);
    // The same answer replays; the other answer is refused, both ways.
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1, decision: 'decline' })).body.data).toEqual({ status: 'declined', replayed: true });
    const late = await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1 });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('MASTERY_OFFER_ANSWERED');
    expect(built.db.course_topic_mastery_credits ?? []).toEqual([]);
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t2, decision: 'accept' })).status).toBe(200);
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t2, decision: 'decline' })).body.error.code).toBe('MASTERY_OFFER_ANSWERED');
    expect(built.db.course_topic_mastery_declines).toHaveLength(1);
    // Another learner's decline is not this learner's.
    place(AGE12, 'money', 'child');
    expect((await post(AGE12, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1, decision: 'decline' })).status).toBe(409);
    expect(built.db.course_topic_mastery_declines).toHaveLength(1);
  });

  it('refuses a topic in a chapter the learner cannot open, and the linear engine refuses both writes', async () => {
    master(KID7, 'kc.t1');
    place(KID7, 'money', 'child');
    expect((await post(KID7, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1 })).status).toBe(409);
    expect(built.db.course_topic_mastery_credits ?? []).toEqual([]);
    process.env.COURSE_PATHWAY_ENGINE = 'linear';
    resetConfigForTests();
    expect((await post(TEEN15, '/learn/courses/money/mastery-credit', { topicId: built.topic.t1 })).body.error.code).toBe('PATHWAY_ENGINE_DISABLED');
    expect((await post(AGE12, '/learn/courses/money/early-access', { chapterId: chapterId('teens') })).body.error.code).toBe('PATHWAY_ENGINE_DISABLED');
  });
});

describe('W2L.4 — a lesson names its course', () => {
  it('GET /learn/lessons/:id carries the course slug, so a deep-linked result finds its badge and its way back', async () => {
    place(TEEN15, 'money', 'teen');
    const res = await get(TEEN15, `/learn/lessons/${built.lesson.t1}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.lesson.course_slug).toBe('money');
  });
});
