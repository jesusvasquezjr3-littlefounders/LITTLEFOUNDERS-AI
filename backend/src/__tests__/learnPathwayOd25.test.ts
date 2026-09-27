import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';

/*
 * OD-25 (owner review P-03 and P-04) at the HTTP boundary, on the pathway
 * engine (COURSE_PATHWAY_ENGINE=pathway), attacked with direct API requests:
 *
 *   POST /learn/courses/:slug/chapters/:chapterId/early-access  {confirm: true}
 *   POST /learn/courses/:slug/topics/:topicId/mastery-offer      {decision}
 *
 * and what GET /learn/courses/:slug/path and the lesson gate say before and
 * after. Core re-derives every decision; the client's word is never enough.
 *
 * Populations: an 11-year-old (tween) and a second one, a parent-created
 * 7-year-old, a 17-year-old, a declared 13–17 teen with no birth date, a
 * 15-year-old, an adult and an unscreened account.
 *
 * Catalog:
 *   money     kids (tier1: k1, k2), teens (teen 13–17: t1, t2), adults (adult 18+: a1)
 *   teenonly  one teen chapter (u1); nothing else, so a tween cannot enter it by age
 *   lonely    one teen chapter (v1) whose skills need nothing: no mastery evidence
 * Graph: k1 -> t1, k2 -> t2, t1 -> a1, k1 -> u1.
 */

const uid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const yearsAgo = (years: number): string => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
};

const TWEEN = uid(201);
const TWEEN2 = uid(202);
const KID7 = uid(203);
const TEEN17 = uid(204);
const TEEN_BAND = uid(205);
const TEEN15 = uid(206);
const ADULT = uid(207);
const UNSCREENED = uid(208);

const COURSE = { money: uid(1), teenonly: uid(2), lonely: uid(3) };

interface Built { db: FakeDb; lesson: Record<string, string>; topic: Record<string, string>; chapter: Record<string, string>; kc: Record<string, string> }

function storyDocument(slug: string) {
  return {
    schema_version: 1,
    meta: { slug, title: slug, locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments: [{ id: 'story', type: 'story_scene', prompt_md: 'Story', difficulty: 1, xp: 0, payload: { backdrop: 'band', body_md: 'The end.' } }],
  };
}

function build(): Built {
  const people: Array<[string, string | null, string | null]> = [
    [TWEEN, 'under_13', yearsAgo(11)], [TWEEN2, 'under_13', yearsAgo(11)], [KID7, 'under_13', yearsAgo(7)],
    [TEEN17, '13_to_17', yearsAgo(17)], [TEEN_BAND, '13_to_17', null], [TEEN15, '13_to_17', yearsAgo(15)], [ADULT, 'adult', null],
  ];
  const db: FakeDb = {
    courses: [], adventures: [], sagas: [], topics: [], lessons: [], lesson_documents: [],
    kc: [], kc_edge: [], topic_knowledge_components: [], learner_kc_mastery: [], memory_card: [],
    course_pathway_badges: [], course_pathway_placements: [], course_placements: [], placement_credits: [],
    course_chapter_early_access: [], course_topic_mastery_decisions: [],
    lesson_progress: [], lesson_segment_attempts: [], completed_course_badges: [],
    account_age_declarations: people.map(([user_id, band]) => ({ user_id, declared_age_band: band })),
    account_safety_origins: [],
    profiles: [...people, [UNSCREENED, null, null] as [string, null, null]].map(([user_id, , birth]) => ({ user_id, display_name: 'L', locale: 'en-US', birth_date: birth })),
    learning_stats: [...people.map(([u]) => u), UNSCREENED].map((user_id) => ({
      user_id, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null,
    })),
    user_roles: [],
    guardian_links: [],
  };
  const built: Built = { db, lesson: {}, topic: {}, chapter: {}, kc: {} };
  let n = 1000;
  const addCourse = (slug: keyof typeof COURSE, chapters: Array<{ slug: string; tier: string; explicit?: [string, number, number | null]; topics: string[] }>) => {
    db.courses!.push({ id: COURSE[slug], slug, title: { 'en-US': slug }, description: {}, subject: 'money', badge_asset: `${slug}.png`, status: 'published', position: db.courses!.length + 1, requires: [] });
    chapters.forEach((chapter, ci) => {
      const adventureId = uid(++n);
      built.chapter[chapter.slug] = adventureId;
      db.adventures!.push({
        id: adventureId, course_id: COURSE[slug], position: ci + 1, slug: chapter.slug, title: { 'en-US': chapter.slug }, description: {}, theme: 't', status: 'published',
        age_tier: chapter.tier, pathway_stage: chapter.explicit?.[0] ?? null, eligibility_min_age: chapter.explicit?.[1] ?? null, eligibility_max_age: chapter.explicit?.[2] ?? null,
      });
      const sagaId = uid(++n);
      db.sagas!.push({ id: sagaId, adventure_id: adventureId, position: 1, slug: 's', title: {}, icon: 'x', status: 'published' });
      chapter.topics.forEach((key, ti) => {
        const topicId = uid(++n);
        built.topic[key] = topicId;
        db.topics!.push({ id: topicId, saga_id: sagaId, position: ti + 1, slug: key, title: { 'en-US': key }, status: 'published', kind: 'teaching', review_of: [], prerequisites: [],
          placement_probe: { 'en-US': { prompt: `Probe ${key}`, options: ['right', 'wrong'], correctIndex: 0 } } });
        const kcId = uid(++n);
        built.kc[key] = kcId;
        db.kc!.push({ id: kcId, key: `kc.${key}`, strand: 'money_life', title: { 'en-US': `Skill ${key}` }, objective: {}, tier_min: 1, p_l0: 0.2, p_t: 0.1, p_g: 0.2, p_s: 0.1, skill_key: null, status: 'active' });
        db.topic_knowledge_components!.push({ topic_id: topicId, kc_id: kcId, role: 'teaches', is_primary: true, map_version: 1 });
        const lessonId = uid(++n);
        built.lesson[key] = lessonId;
        db.lessons!.push({ id: lessonId, topic_id: topicId, position: 1, slug: key, title: { 'en-US': key }, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' });
        db.lesson_documents!.push({ lesson_id: lessonId, locale: 'en-US', schema_version: 1, updated_at: '2026-09-01T00:00:00.000Z', document: storyDocument(key), answer_keys: {}, audio: {} });
      });
    });
  };
  addCourse('money', [
    { slug: 'kids', tier: 'tier1', topics: ['k1', 'k2'] },
    { slug: 'teens', tier: 'tier4', explicit: ['teen', 13, 17], topics: ['t1', 't2'] },
    { slug: 'adults', tier: 'tier4', explicit: ['adult', 18, null], topics: ['a1'] },
  ]);
  addCourse('teenonly', [{ slug: 'teens-only', tier: 'tier4', explicit: ['teen', 13, 17], topics: ['u1'] }]);
  addCourse('lonely', [{ slug: 'lonely-teens', tier: 'tier4', explicit: ['teen', 13, 17], topics: ['v1'] }]);
  for (const [from, to] of [['k1', 't1'], ['k2', 't2'], ['t1', 'a1'], ['k1', 'u1']] as const) {
    db.kc_edge!.push({ prerequisite_kc_id: built.kc[from], dependent_kc_id: built.kc[to] });
  }
  return built;
}

let b: Built;
const place = (user: string, course: keyof typeof COURSE, stage: string) =>
  b.db.course_pathway_placements!.push({ user_id: user, course_id: COURSE[course], pathway_stage: stage, method: 'learner_chose_start', start_topic_id: null, credited_topics: 0 });
const master = (user: string, key: string, p = 0.9) =>
  b.db.learner_kc_mastery!.push({ user_id: user, kc_id: b.kc[key], p_known: p, attempts: 6, correct: 5, params_override: null });
const as = (user: string) => (req: request.Test) => req.set('Authorization', `Bearer ${mintToken({ sub: user })}`);
const get = (user: string, path: string) => as(user)(request(createApp()).get(`/api/v1${path}`));
const post = (user: string, path: string, body: object = {}) => as(user)(request(createApp()).post(`/api/v1${path}`).send(body));
const early = (user: string, course: string, chapterId: string, body: object = { confirm: true }) => post(user, `/learn/courses/${course}/chapters/${chapterId}/early-access`, body);
const offer = (user: string, course: string, topicId: string, decision: string) => post(user, `/learn/courses/${course}/topics/${topicId}/mastery-offer`, { decision });
type PathChapter = { id: string; access: string; earlyAccess?: { status: string; stage: string; missingSkills: Array<{ key: string }>; prerequisiteSkills: Array<{ key: string }> } };
const chapterOf = (body: { data: { chapters: PathChapter[] } }, id: string): PathChapter => body.data.chapters.find((c) => c.id === id)!;

beforeEach(() => {
  process.env.COURSE_PATHWAY_ENGINE = 'pathway';
  resetConfigForTests();
  b = build();
  vi.stubGlobal('fetch', createFakeFetch(b.db));
});

afterEach(() => {
  delete process.env.COURSE_PATHWAY_ENGINE;
  resetConfigForTests();
  vi.unstubAllGlobals();
});

describe('both OD-25 endpoints refuse before deciding anything', () => {
  it('unauthenticated, unscreened and the linear engine are refused on both', async () => {
    const paths = [`/learn/courses/money/chapters/${b.chapter.teens}/early-access`, `/learn/courses/money/topics/${b.topic.t2}/mastery-offer`];
    for (const path of paths) {
      expect((await request(createApp()).post(`/api/v1${path}`).send({ confirm: true, decision: 'accept' })).status).toBe(401);
    }
    expect((await early(UNSCREENED, 'money', b.chapter.teens!)).body.error.code).toBe('AGE_SCREEN_REQUIRED');
    expect((await offer(UNSCREENED, 'money', b.topic.t2!, 'accept')).body.error.code).toBe('AGE_SCREEN_REQUIRED');
    delete process.env.COURSE_PATHWAY_ENGINE;
    resetConfigForTests();
    const linearEarly = await early(TWEEN, 'money', b.chapter.teens!);
    expect([linearEarly.status, linearEarly.body.error.code]).toEqual([409, 'PATHWAY_ENGINE_DISABLED']);
    const linearOffer = await offer(TEEN15, 'money', b.topic.t2!, 'accept');
    expect([linearOffer.status, linearOffer.body.error.code]).toEqual([409, 'PATHWAY_ENGINE_DISABLED']);
    expect(b.db.course_chapter_early_access).toEqual([]);
    expect(b.db.course_topic_mastery_decisions).toEqual([]);
  });

  it('refuses a body that is not an explicit confirmation or decision', async () => {
    for (const body of [{}, { confirm: false }, { confirm: 'true' }, { confirm: true, stage: 'teen' }]) {
      expect((await early(TWEEN, 'money', b.chapter.teens!, body)).body.error.code, JSON.stringify(body)).toBe('VALIDATION_ERROR');
    }
    for (const decision of ['yes', 'accepted', '']) expect((await offer(TEEN15, 'money', b.topic.t2!, decision)).status).toBe(400);
    expect(b.db.course_chapter_early_access).toEqual([]);
  });
});

describe('P-03 / P8: a minor opens a chapter one stage up only with every prerequisite mastered and a confirmation', () => {
  it('a tween without the prerequisites sees what is missing and is refused; nothing is written', async () => {
    place(TWEEN, 'money', 'child');
    master(TWEEN, 'k1');
    const path = await get(TWEEN, '/learn/courses/money/path');
    expect(path.status, JSON.stringify(path.body)).toBe(200);
    const teens = chapterOf(path.body, b.chapter.teens!);
    expect(teens.access).toBe('closed');
    expect(teens.earlyAccess).toMatchObject({ status: 'missing-prerequisites', stage: 'teen' });
    expect(teens.earlyAccess!.prerequisiteSkills.map((s) => s.key)).toEqual(['kc.k1', 'kc.k2']);
    expect(teens.earlyAccess!.missingSkills.map((s) => s.key)).toEqual(['kc.k2']);
    // The adult chapter is two stages up and adult: the rule does not even speak about it.
    expect(chapterOf(path.body, b.chapter.adults!).earlyAccess).toBeUndefined();
    const refused = await early(TWEEN, 'money', b.chapter.teens!);
    expect(refused.status).toBe(403);
    expect(refused.body.error).toMatchObject({ code: 'EARLY_ACCESS_NOT_ELIGIBLE', reason: 'missing-prerequisites', missingSkills: ['kc.k2'] });
    expect(b.db.course_chapter_early_access).toEqual([]);
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.t1}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');
  });

  it('eligible: the path offers it, a GET opens nothing, the confirmation opens it idempotently and the lesson gate admits', async () => {
    place(TWEEN, 'money', 'child');
    master(TWEEN, 'k1');
    // k2 through graded course evidence instead of the Mentor: both count (E2).
    b.db.lesson_progress!.push({ user_id: TWEEN, lesson_id: b.lesson.k2, passed: true, best_score: 90, xp_earned: 10 });
    const before = await get(TWEEN, '/learn/courses/money/path');
    expect(chapterOf(before.body, b.chapter.teens!)).toMatchObject({ access: 'closed', earlyAccess: { status: 'offer', missingSkills: [] } });
    await get(TWEEN, '/learn/courses/money/path');
    expect(b.db.course_chapter_early_access).toEqual([]);
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.t1}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');

    const first = await early(TWEEN, 'money', b.chapter.teens!);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.data).toMatchObject({ replayed: false, earlyAccess: { courseId: COURSE.money, chapterId: b.chapter.teens, stage: 'teen' } });
    expect(b.db.course_chapter_early_access).toEqual([expect.objectContaining({
      user_id: TWEEN, course_id: COURSE.money, adventure_id: b.chapter.teens, pathway_stage: 'teen', learner_stage: 'tween', prerequisite_kcs: ['kc.k1', 'kc.k2'],
    })]);
    const again = await early(TWEEN, 'money', b.chapter.teens!);
    expect(again.status).toBe(200);
    expect(again.body.data).toEqual({ ...first.body.data, replayed: true });
    expect(b.db.course_chapter_early_access).toHaveLength(1);

    const after = await get(TWEEN, '/learn/courses/money/path');
    // Optional beside the child pathway (P5, B3): playable, never required, never counted.
    expect(chapterOf(after.body, b.chapter.teens!)).toMatchObject({ access: 'optional', earlyAccess: { status: 'confirmed' } });
    expect(after.body.data.pathway).toMatchObject({ learnerStage: 'tween', pathwayStage: 'child', basis: 'younger-bridge' });
    expect(after.body.data.pathway.progress.total).toBe(2);
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.t1}`)).status).toBe(200);
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.a1}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');
    // Another learner of the same age gains nothing from this learner's confirmation.
    place(TWEEN2, 'money', 'child');
    expect((await get(TWEEN2, `/learn/lessons/${b.lesson.t1}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');
  });

  it('keeps the confirmed access when the Mentor estimate later dips, and re-closes it when the age half fails', async () => {
    place(TWEEN, 'money', 'child');
    master(TWEEN, 'k1');
    master(TWEEN, 'k2');
    expect((await early(TWEEN, 'money', b.chapter.teens!)).status).toBe(200);
    for (const row of b.db.learner_kc_mastery!) row.p_known = 0.2;
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.t1}`)).status).toBe(200);
    // A corrected birth date makes the teen chapter two stages up: closed again, and a replay is refused.
    b.db.profiles!.find((row) => row.user_id === TWEEN)!.birth_date = yearsAgo(8);
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.t1}`)).body.error.code).toBe('LESSON_AGE_RESTRICTED');
    const replay = await early(TWEEN, 'money', b.chapter.teens!);
    expect(replay.status).toBe(403);
    expect(replay.body.error).toMatchObject({ code: 'EARLY_ACCESS_NOT_ELIGIBLE', reason: 'age-stage' });
  });

  it('a client lying about eligibility is refused: adult chapter, two stages up, a chapter with no prerequisites, unknown or foreign ids', async () => {
    for (const key of ['k1', 'k2', 't1', 't2', 'u1', 'v1']) { master(TWEEN, key, 0.99); master(KID7, key, 0.99); master(TEEN17, key, 0.99); master(TEEN_BAND, key, 0.99); }
    const adult = await early(TWEEN, 'money', b.chapter.adults!);
    expect([adult.status, adult.body.error.code, adult.body.error.reason]).toEqual([403, 'EARLY_ACCESS_NOT_ELIGIBLE', 'age-stage']);
    const twoUp = await early(KID7, 'money', b.chapter.teens!);
    expect([twoUp.status, twoUp.body.error.reason]).toEqual([403, 'age-stage']);
    for (const teen of [TEEN17, TEEN_BAND]) {
      const res = await early(teen, 'money', b.chapter.adults!);
      expect([res.status, res.body.error.code, res.body.error.reason], teen).toEqual([403, 'EARLY_ACCESS_NOT_ELIGIBLE', 'age-stage']);
    }
    const lonely = await early(TWEEN, 'lonely', b.chapter['lonely-teens']!);
    expect([lonely.status, lonely.body.error.reason]).toEqual([403, 'no-prerequisites']);
    expect((await early(TWEEN, 'money', b.chapter['teens-only']!)).status).toBe(404); // a chapter of another course
    expect((await early(TWEEN, 'money', uid(99999))).status).toBe(404);
    expect((await early(TWEEN, 'money', 'not-a-uuid')).status).toBe(404);
    expect((await early(TWEEN, 'no-such-course', b.chapter.teens!)).status).toBe(404);
    expect(b.db.course_chapter_early_access).toEqual([]);
  });

  it('adults are unaffected: a chapter age already opens answers CHAPTER_ALREADY_OPEN and nothing is recorded', async () => {
    const res = await early(ADULT, 'money', b.chapter.teens!);
    expect([res.status, res.body.error.code]).toEqual([409, 'CHAPTER_ALREADY_OPEN']);
    expect(b.db.course_chapter_early_access).toEqual([]);
  });

  it('a course nothing opens by age names its early chapter in the refusal; once confirmed it becomes the older-early pathway', async () => {
    master(TWEEN, 'k1');
    const refused = await get(TWEEN, '/learn/courses/teenonly/path');
    expect(refused.status).toBe(403);
    expect(refused.body.error).toMatchObject({ code: 'COURSE_AGE_RESTRICTED', earlyAccessChapters: [{ chapterId: b.chapter['teens-only'], status: 'offer', stage: 'teen' }] });
    // Without any detail for a learner the rule does not speak about.
    expect((await get(KID7, '/learn/courses/teenonly/path')).body.error.earlyAccessChapters).toBeUndefined();
    expect((await early(TWEEN, 'teenonly', b.chapter['teens-only']!)).status).toBe(200);
    const path = await get(TWEEN, '/learn/courses/teenonly/path');
    expect(path.status, JSON.stringify(path.body)).toBe(200);
    expect(path.body.data.pathway).toMatchObject({ pathwayStage: 'teen', basis: 'older-early', placementRequired: true });
    expect(chapterOf(path.body, b.chapter['teens-only']!)).toMatchObject({ access: 'pathway', earlyAccess: { status: 'confirmed' } });
    // Admission now follows the ordinary gates: the teen stage needs its entry placement (P6).
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.u1}`)).body.error.code).toBe('PLACEMENT_REQUIRED');
    place(TWEEN, 'teenonly', 'teen');
    expect((await get(TWEEN, `/learn/lessons/${b.lesson.u1}`)).status).toBe(200);
  });
});

describe('P-04 / E3: Mentor mastery completes a topic only after the learner accepts', () => {
  it('offers the mastered topic on the path; reads never complete it; refusals for everything that is not the offer', async () => {
    place(TEEN15, 'money', 'teen');
    master(TEEN15, 't2', 0.9);
    master(TEEN15, 'a1', 0.99); // an adult-chapter skill: closed chapter, never offered
    const path = await get(TEEN15, '/learn/courses/money/path');
    expect(path.body.data.masteryOffers).toEqual([{ topicId: b.topic.t2, topicTitle: { 'en-US': 't2' }, chapterId: b.chapter.teens, skills: [{ key: 'kc.t2', title: { 'en-US': 'Skill t2' } }] }]);
    expect(path.body.data.masteryCompleted).toEqual([]);
    await get(TEEN15, '/learn/courses/money/path');
    await get(TEEN15, '/learn/courses/money/tree');
    expect(b.db.course_topic_mastery_decisions).toEqual([]);
    expect(path.body.data.pathway.progress).toMatchObject({ passed: 0, total: 2 });

    const notOffered = await offer(TEEN15, 'money', b.topic.t1!, 'accept');
    expect([notOffered.status, notOffered.body.error.code]).toEqual([403, 'MASTERY_OFFER_NOT_ELIGIBLE']);
    expect((await offer(TEEN15, 'money', b.topic.t1!, 'decline')).status).toBe(403);
    expect((await offer(TEEN15, 'money', b.topic.a1!, 'accept')).body.error.code).toBe('MASTERY_OFFER_NOT_ELIGIBLE');
    expect((await offer(TEEN15, 'money', b.topic.u1!, 'accept')).status).toBe(404); // a topic of another course
    expect((await offer(TEEN15, 'money', uid(99999), 'accept')).status).toBe(404);
    expect((await offer(TEEN15, 'money', 'nope', 'accept')).status).toBe(404);
    // Behind the ordinary course entry: a child never reaches a teen-only course's topics.
    expect((await offer(KID7, 'teenonly', b.topic.u1!, 'accept')).body.error.code).toBe('COURSE_AGE_RESTRICTED');
    expect(b.db.course_topic_mastery_decisions).toEqual([]);
  });

  it('accept: idempotent, final, completes the topic for progress and the frontier, keeps its lesson playable, and does not earn the badge alone', async () => {
    place(TEEN15, 'money', 'teen');
    master(TEEN15, 't2', 0.9);
    const accepted = await offer(TEEN15, 'money', b.topic.t2!, 'accept');
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(accepted.body.data).toMatchObject({ replayed: false, masteryOffer: { courseId: COURSE.money, topicId: b.topic.t2, decision: 'accepted', skills: ['kc.t2'] } });
    const replay = await offer(TEEN15, 'money', b.topic.t2!, 'accept');
    expect(replay.body.data).toEqual({ ...accepted.body.data, replayed: true });
    const flip = await offer(TEEN15, 'money', b.topic.t2!, 'decline');
    expect([flip.status, flip.body.error.code, flip.body.error.decision]).toEqual([409, 'MASTERY_OFFER_ALREADY_DECIDED', 'accepted']);
    expect(b.db.course_topic_mastery_decisions).toEqual([expect.objectContaining({ user_id: TEEN15, topic_id: b.topic.t2, decision: 'accepted', kcs: ['kc.t2'] })]);
    // No XP and no lesson pass were invented.
    expect(b.db.lesson_progress).toEqual([]);
    expect(b.db.learning_stats!.find((row) => row.user_id === TEEN15)!.xp_points).toBe(0);

    const path = await get(TEEN15, '/learn/courses/money/path');
    expect(path.body.data.masteryOffers).toEqual([]);
    expect(path.body.data.masteryCompleted).toEqual([{ topicId: b.topic.t2, topicTitle: { 'en-US': 't2' }, chapterId: b.chapter.teens, lessonId: b.lesson.t2 }]);
    expect(path.body.data.pathway.progress).toMatchObject({ passed: 1, total: 2, pct: 50 });
    expect((await get(TEEN15, `/learn/lessons/${b.lesson.t2}`)).status).toBe(200);

    // Finishing the only other topic completes the pathway, but the stage badge waits for graded evidence (B6).
    expect((await post(TEEN15, `/learn/lessons/${b.lesson.t1}/complete`, { minutes_spent: 1 })).status).toBe(200);
    const tree = await get(TEEN15, '/learn/courses/money/tree');
    expect(tree.body.data.pathway.progress).toMatchObject({ complete: true, pct: 100 });
    expect(tree.body.data.pathway.badge).toMatchObject({ eligible: false, awaitingGradedTopics: 1 });
    expect(b.db.course_pathway_badges).toEqual([]);
    expect((await post(TEEN15, `/learn/lessons/${b.lesson.t2}/complete`, { minutes_spent: 1 })).status).toBe(200);
    expect(b.db.course_pathway_badges).toEqual([expect.objectContaining({ user_id: TEEN15, award_key: 'teen', basis: 'own_stage' })]);
  });

  it('decline: recorded once, the offer never returns, accept afterwards is refused, and the topic stays completable by its lessons', async () => {
    place(TEEN15, 'money', 'teen');
    master(TEEN15, 't2', 0.9);
    const declined = await offer(TEEN15, 'money', b.topic.t2!, 'decline');
    expect(declined.body.data.masteryOffer.decision).toBe('declined');
    expect((await offer(TEEN15, 'money', b.topic.t2!, 'decline')).body.data.replayed).toBe(true);
    const late = await offer(TEEN15, 'money', b.topic.t2!, 'accept');
    expect([late.status, late.body.error.code, late.body.error.decision]).toEqual([409, 'MASTERY_OFFER_ALREADY_DECIDED', 'declined']);
    const path = await get(TEEN15, '/learn/courses/money/path');
    expect(path.body.data.masteryOffers).toEqual([]);
    expect(path.body.data.masteryCompleted).toEqual([]);
    expect(path.body.data.pathway.progress).toMatchObject({ passed: 0, total: 2 });
    // F8 still opens it (the skill is shown); completion needs its lesson.
    expect(path.body.data.items.map((i: { topicId: string; reason: string }) => [i.topicId, i.reason])).toContainEqual([b.topic.t2, 'known']);
    expect((await post(TEEN15, `/learn/lessons/${b.lesson.t2}/complete`, { minutes_spent: 1 })).status).toBe(200);
  });

  it("one learner's decision never touches another learner", async () => {
    place(TEEN15, 'money', 'teen');
    place(TEEN17, 'money', 'teen');
    master(TEEN15, 't2', 0.9);
    master(TEEN17, 't2', 0.9);
    expect((await offer(TEEN15, 'money', b.topic.t2!, 'accept')).status).toBe(200);
    const other = await get(TEEN17, '/learn/courses/money/path');
    expect(other.body.data.masteryOffers.map((o: { topicId: string }) => o.topicId)).toEqual([b.topic.t2]);
    expect(other.body.data.masteryCompleted).toEqual([]);
    // A learner without the mastery cannot accept on the strength of someone else's.
    expect((await offer(TEEN_BAND, 'money', b.topic.t2!, 'accept')).body.error.code).toBe('MASTERY_OFFER_NOT_ELIGIBLE');
  });
});
