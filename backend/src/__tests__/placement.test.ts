import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';

const USER_ID = '99999999-9999-4999-8999-999999999911';
const COURSE_ID = 'c0000000-0000-4000-8000-000000000001';
const ADVENTURE_ID = 'a0000000-0000-4000-8000-000000000001';
const SAGA_ID = 'a0000000-0000-4000-8000-0000000000a1';
const T1 = 'a0000000-0000-4000-8000-0000000000b1';
const T2 = 'a0000000-0000-4000-8000-0000000000b2';
const T3 = 'a0000000-0000-4000-8000-0000000000b3';
const L1 = 'a0000000-0000-4000-8000-0000000000c1';
const L2 = 'a0000000-0000-4000-8000-0000000000c2';
const L3 = 'a0000000-0000-4000-8000-0000000000c3';
const COURSE_SLUG = 'placement-course';

const probeFor = (subject: string, correctIndex: number) => ({
  'en-US': { prompt: `What is ${subject}?`, options: ['Wrong one', 'Right one'], correctIndex },
  'es-MX': { prompt: `¿Qué es ${subject}?`, options: ['La incorrecta', 'La correcta'], correctIndex },
});

const PROBE_T1 = probeFor('money', 1);
const PROBE_T2 = probeFor('saving', 1);
const PROBE_T3 = probeFor('budgeting', 1);

function makeDb(): FakeDb {
  return {
    courses: [{ id: COURSE_ID, slug: COURSE_SLUG, title: { 'en-US': 'Money' }, description: {}, subject: 'money', badge_asset: 'course-badges/x.png', status: 'published', position: 1 }],
    adventures: [{ id: ADVENTURE_ID, course_id: COURSE_ID, position: 1, slug: 'adventure-1', title: { 'en-US': 'Trading' }, description: {}, theme: 'archipelago', status: 'published' }],
    sagas: [{ id: SAGA_ID, adventure_id: ADVENTURE_ID, position: 1, slug: 'saga-1', title: {}, icon: 'auto_stories', status: 'published' }],
    topics: [
      { id: T1, saga_id: SAGA_ID, position: 1, slug: 'topic-1', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T1, status: 'published' },
      { id: T2, saga_id: SAGA_ID, position: 2, slug: 'topic-2', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T2, status: 'published' },
      { id: T3, saga_id: SAGA_ID, position: 3, slug: 'topic-3', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T3, status: 'published' },
    ],
    lessons: [
      { id: L1, topic_id: T1, position: 1, slug: 'lesson-1', title: {}, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' },
      { id: L2, topic_id: T2, position: 1, slug: 'lesson-2', title: {}, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' },
      { id: L3, topic_id: T3, position: 1, slug: 'lesson-3', title: {}, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' },
    ],
    lesson_progress: [],
    course_placements: [],
    placement_credits: [],
    profiles: [{ user_id: USER_ID, display_name: 'Ana', username: null, locale: 'en-US', theme: 'light', cover: {}, birth_date: null, created_at: '2026-01-01T00:00:00.000Z' }],
  };
}

let db: FakeDb;
let token: string;

beforeEach(() => {
  token = mintToken({ sub: USER_ID });
  db = makeDb();
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
const step = (body: unknown) => auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/step`)).send(body);
const commit = (body: unknown) => auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/commit`)).send(body);

/** Walks the whole quiz, answering correctly for topics in `knows`. */
async function playQuiz(knows: Set<string>, signals: Record<string, unknown> = {}) {
  const answers: Array<{ topicId: string; selectedIndex: number }> = [];
  for (let guard = 0; guard < 12; guard++) {
    const res = await step({ signals, answers });
    expect(res.status).toBe(200);
    if (res.body.data.kind === 'done') return { answers, result: res.body.data.result };
    const topicId = res.body.data.probe.topicId as string;
    answers.push({ topicId, selectedIndex: knows.has(topicId) ? 1 : 0 });
  }
  throw new Error('quiz did not finish');
}

describe('GET /api/v1/placement/:courseSlug/intake', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/intake`);
    expect(res.status).toBe(401);
  });

  it('404s for an unknown course slug', async () => {
    const res = await auth(request(createApp()).get('/api/v1/placement/does-not-exist/intake'));
    expect(res.status).toBe(404);
  });

  it('reports ageAlreadyKnown from the profile', async () => {
    const before = await auth(request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/intake`));
    expect(before.body.data.ageAlreadyKnown).toBe(false);

    db.profiles[0]!.birth_date = '2016-05-01';
    const after = await auth(request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/intake`));
    expect(after.body.data.ageAlreadyKnown).toBe(true);
  });

  /*
   * The §1.9 floor. Under 12 never sees a free-text box, and neither does an
   * unknown birth date — "we cannot rule out that this is a seven-year-old" is
   * not a basis for opening one.
   */
  it('offers the conversational intake to a 12+ learner only', async () => {
    db.profiles[0]!.birth_date = '2000-01-01';
    const adult = await auth(request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/intake`));
    expect(adult.body.data.conversationalIntakeAvailable).toBe(true);

    db.profiles[0]!.birth_date = '2019-01-01';
    const child = await auth(request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/intake`));
    expect(child.body.data.conversationalIntakeAvailable).toBe(false);

    db.profiles[0]!.birth_date = null;
    const unknown = await auth(request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/intake`));
    expect(unknown.body.data.conversationalIntakeAvailable).toBe(false);
  });
});

describe('POST /api/v1/placement/:courseSlug/step', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/step`).send({});
    expect(res.status).toBe(401);
  });

  it('400s on a body with a field the schema does not name', async () => {
    const res = await step({ signals: {}, answers: [], sneakyFrontier: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('asks an answer-stripped question and never leaks correctIndex', async () => {
    const res = await step({ signals: {}, answers: [] });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe('ask');
    expect(res.body.data.probe).not.toHaveProperty('correctIndex');
    expect(res.body.data.probe.options).toHaveLength(2);
    expect(res.body.data.questionNumber).toBe(1);
  });

  it('writes nothing — a learner can walk the quiz repeatedly before committing', async () => {
    await playQuiz(new Set([T1, T2, T3]));
    await playQuiz(new Set());
    expect(db.course_placements).toHaveLength(0);
    expect(db.placement_credits).toHaveLength(0);
  });

  it('is stateless: the same answers always produce the same next question', async () => {
    const first = await step({ signals: {}, answers: [] });
    const topicId = first.body.data.probe.topicId;
    const a = await step({ signals: {}, answers: [{ topicId, selectedIndex: 1 }] });
    const b = await step({ signals: {}, answers: [{ topicId, selectedIndex: 1 }] });
    expect(a.body.data).toEqual(b.body.data);
  });
});

describe('POST /api/v1/placement/:courseSlug/commit', () => {
  it('404s for an unknown course slug', async () => {
    const res = await auth(request(createApp()).post('/api/v1/placement/does-not-exist/commit')).send({});
    expect(res.status).toBe(404);
  });

  it('a learner who knows nothing starts at the first lesson, crediting nothing', async () => {
    const { answers } = await playQuiz(new Set());
    const res = await commit({ signals: {}, answers });
    expect(res.status).toBe(201);
    expect(res.body.data.startLessonId).toBe(L1);
    expect(res.body.data.creditedLessonCount).toBe(0);
    expect(db.placement_credits).toHaveLength(0);
  });

  /*
   * The whole point. Under the previous prefix walk this learner could be
   * credited at most 6 topics however much they knew; here they clear the
   * course they demonstrably know.
   */
  it('a learner who knows everything is credited past the whole course', async () => {
    const { answers } = await playQuiz(new Set([T1, T2, T3]));
    const res = await commit({ signals: { claimedLevel: 'confident', educationLevel: 'adult' }, answers });
    expect(res.status).toBe(201);
    expect(res.body.data.creditedLessonCount).toBe(3);
    expect(res.body.data.startLessonId).toBeNull();
    expect(db.placement_credits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: USER_ID, lesson_id: L1, topic_id: T1, course_id: COURSE_ID }),
        expect.objectContaining({ user_id: USER_ID, lesson_id: L3, topic_id: T3, course_id: COURSE_ID }),
      ]),
    );
  });

  it('grades server-side — a client cannot claim credit by asserting it', async () => {
    // Every answer deliberately wrong (correctIndex is 1 on all three probes).
    const res = await commit({
      signals: {},
      answers: [
        { topicId: T1, selectedIndex: 0 },
        { topicId: T2, selectedIndex: 0 },
        { topicId: T3, selectedIndex: 0 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.creditedLessonCount).toBe(0);
    expect(res.body.data.startLessonId).toBe(L1);
  });

  it('ignores an answer for a topic that is not in this course', async () => {
    const res = await commit({
      signals: {},
      answers: [{ topicId: '11111111-1111-4111-8111-111111111111', selectedIndex: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.creditedLessonCount).toBe(0);
  });

  it('startFromBeginning skips the quiz entirely and records it as the learner\'s own choice', async () => {
    const res = await commit({ signals: { claimedLevel: 'new' }, answers: [], startFromBeginning: true });
    expect(res.status).toBe(201);
    expect(res.body.data.startLessonId).toBe(L1);
    expect(db.course_placements[0]).toMatchObject({ method: 'learner_chose_start', start_lesson_id: L1 });
  });

  it('lets a learner move themselves EARLIER than the quiz placed them', async () => {
    const { answers } = await playQuiz(new Set([T1, T2, T3]));
    const res = await commit({ signals: {}, answers, chosenFrontier: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.creditedLessonCount).toBe(1);
    expect(res.body.data.startLessonId).toBe(L2);
    expect(db.course_placements[0]).toMatchObject({ method: 'learner_adjusted' });
  });

  /*
   * Downward only. Moving yourself earlier costs the learner time; moving
   * yourself later would skip content no answer established, which is exactly
   * the failure the quiz exists to prevent.
   */
  it('refuses to let a learner move themselves LATER than their answers earned', async () => {
    const { answers } = await playQuiz(new Set());
    const res = await commit({ signals: {}, answers, chosenFrontier: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.creditedLessonCount).toBe(0);
    expect(res.body.data.startLessonId).toBe(L1);
  });

  it('409s PLACEMENT_ALREADY_COMPLETE on a retry, without writing a second row', async () => {
    await commit({ signals: {}, answers: [], startFromBeginning: true });
    const res = await commit({ signals: {}, answers: [], startFromBeginning: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLACEMENT_ALREADY_COMPLETE');
    expect(db.course_placements).toHaveLength(1);
  });

  it('saves birthDate only when the profile did not already have one', async () => {
    await commit({ signals: { birthDate: '2016-05-01' }, answers: [], startFromBeginning: true });
    expect(db.profiles[0]!.birth_date).toBe('2016-05-01');
  });

  it('never overwrites an existing birthDate', async () => {
    db.profiles[0]!.birth_date = '2010-01-01';
    await commit({ signals: { birthDate: '2016-05-01' }, answers: [], startFromBeginning: true });
    expect(db.profiles[0]!.birth_date).toBe('2010-01-01');
  });
});

/*
 * The product promise at the HTTP boundary, not just in the pure module: the
 * same answers place the same way whatever the learner said about their age.
 */
describe('placement is decided by the graph, not by age', () => {
  it('places an adult and a small child identically when they answer identically', async () => {
    const adult = await playQuiz(new Set([T1]), { claimedLevel: 'confident', educationLevel: 'adult', birthDate: '1990-01-01' });
    db = makeDb();
    vi.stubGlobal('fetch', createFakeFetch(db));
    const child = await playQuiz(new Set([T1]), { claimedLevel: 'new', educationLevel: 'preschool', birthDate: '2019-01-01' });

    expect(adult.result.frontier).toBe(child.result.frontier);
    expect(adult.result.startLessonId).toBe(child.result.startLessonId);
  });
});

describe('PLACEMENT_REQUIRED gates the 3 lesson-access endpoints in learn.ts', () => {
  it('blocks GET /learn/lessons/:id, POST .../grade, and POST .../complete until placement is done, then unblocks after', async () => {
    const app = createApp();

    const getRes = await auth(request(app).get(`/api/v1/learn/lessons/${L1}`));
    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('PLACEMENT_REQUIRED');

    const gradeRes = await auth(request(app).post(`/api/v1/learn/lessons/${L1}/grade`)).send({
      segment_id: 'x', answer: {}, attempt_number: 1,
    });
    expect(gradeRes.status).toBe(403);
    expect(gradeRes.body.error.code).toBe('PLACEMENT_REQUIRED');

    const completeRes = await auth(request(app).post(`/api/v1/learn/lessons/${L1}/complete`)).send({ seconds_spent: 30 });
    expect(completeRes.status).toBe(403);
    expect(completeRes.body.error.code).toBe('PLACEMENT_REQUIRED');

    await commit({ signals: {}, answers: [], startFromBeginning: true });

    const treeRes = await auth(request(app).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(treeRes.status).toBe(200);
    expect(treeRes.body.data.course.placementRequired).toBe(false);
  });
});
