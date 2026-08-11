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

const PROBE_T1 = {
  'en-US': { prompt: 'What is money?', options: ['Used to trade', 'A toy'], correctIndex: 0 },
  'es-MX': { prompt: '¿Qué es el dinero?', options: ['Sirve para intercambiar', 'Es un juguete'], correctIndex: 0 },
};
const PROBE_T2 = {
  'en-US': { prompt: 'What is saving?', options: ['Spending it all', 'Keeping some for later'], correctIndex: 1 },
  'es-MX': { prompt: '¿Qué es ahorrar?', options: ['Gastarlo todo', 'Guardar una parte'], correctIndex: 1 },
};

function makeDb(): FakeDb {
  return {
    courses: [{ id: COURSE_ID, slug: COURSE_SLUG, title: {}, description: {}, subject: 'money', badge_asset: 'course-badges/x.png', status: 'published', position: 1 }],
    adventures: [{ id: ADVENTURE_ID, course_id: COURSE_ID, position: 1, slug: 'adventure-1', title: {}, description: {}, theme: 'archipelago', status: 'published' }],
    sagas: [{ id: SAGA_ID, adventure_id: ADVENTURE_ID, position: 1, slug: 'saga-1', title: {}, icon: 'auto_stories', status: 'published' }],
    topics: [
      { id: T1, saga_id: SAGA_ID, position: 1, slug: 'topic-1', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T1, status: 'published' },
      { id: T2, saga_id: SAGA_ID, position: 2, slug: 'topic-2', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T2, status: 'published' },
      { id: T3, saga_id: SAGA_ID, position: 3, slug: 'topic-3', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: null, status: 'published' },
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

describe('GET /api/v1/placement/:courseSlug/probe', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/probe`);
    expect(res.status).toBe(401);
  });

  it('404s for an unknown course slug', async () => {
    const res = await auth(request(createApp()).get('/api/v1/placement/does-not-exist/probe'));
    expect(res.status).toBe(404);
  });

  it('returns answer-stripped probes in course order, locale-picked from the profile', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/probe`));
    expect(res.status).toBe(200);
    expect(res.body.data.probes).toEqual([
      { topicId: T1, prompt: 'What is money?', options: ['Used to trade', 'A toy'] },
      { topicId: T2, prompt: 'What is saving?', options: ['Spending it all', 'Keeping some for later'] },
    ]);
    for (const probe of res.body.data.probes) expect(probe).not.toHaveProperty('correctIndex');
    expect(res.body.data.ageAlreadyKnown).toBe(false);
  });

  it('reports ageAlreadyKnown when profile.birth_date is already set', async () => {
    db.profiles[0]!.birth_date = '2016-05-01';
    const res = await auth(request(createApp()).get(`/api/v1/placement/${COURSE_SLUG}/probe`));
    expect(res.body.data.ageAlreadyKnown).toBe(true);
  });
});

describe('POST /api/v1/placement/:courseSlug/complete', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`).send({});
    expect(res.status).toBe(401);
  });

  it('400s on a malformed body', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({ claimedLevel: 'expert' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404s for an unknown course slug', async () => {
    const res = await auth(request(createApp()).post('/api/v1/placement/does-not-exist/complete')).send({
      claimedLevel: 'new', educationLevel: 'elementary', quizAnswers: [],
    });
    expect(res.status).toBe(404);
  });

  it('claimed_beginner_shortcut: "new" records the placement and starts at lesson 1, crediting nothing', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'new', educationLevel: 'elementary', quizAnswers: [],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ startLessonId: L1, creditedLessonCount: 0 });
    expect(db.course_placements).toHaveLength(1);
    expect(db.course_placements[0]).toMatchObject({ method: 'claimed_beginner_shortcut', start_lesson_id: L1 });
    expect(db.placement_credits).toHaveLength(0);
  });

  it('quiz: grades server-side, credits the correct-and-probed prefix, and writes placement_credits with the right topic/course ids', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'confident',
      educationLevel: 'middle',
      quizAnswers: [
        { topicId: T1, selectedIndex: 0 }, // correct
        { topicId: T2, selectedIndex: 1 }, // correct
      ],
    });
    expect(res.status).toBe(201);
    // t3 has no probe -> stops the prefix -> t1+t2 credited, start at t3's lesson.
    expect(res.body.data).toEqual({ startLessonId: L3, creditedLessonCount: 2 });
    expect(db.placement_credits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: USER_ID, lesson_id: L1, topic_id: T1, course_id: COURSE_ID }),
        expect.objectContaining({ user_id: USER_ID, lesson_id: L2, topic_id: T2, course_id: COURSE_ID }),
      ]),
    );
  });

  it('quiz: a wrong answer stops the credited prefix (server-graded, never trusts a client-claimed correctness)', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'confident',
      educationLevel: 'middle',
      quizAnswers: [{ topicId: T1, selectedIndex: 1 }], // WRONG (correctIndex is 0)
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ startLessonId: L1, creditedLessonCount: 0 });
  });

  it('409s PLACEMENT_ALREADY_COMPLETE on a retry, without writing a second row', async () => {
    await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'new', educationLevel: 'elementary', quizAnswers: [],
    });
    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'new', educationLevel: 'elementary', quizAnswers: [],
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLACEMENT_ALREADY_COMPLETE');
    expect(db.course_placements).toHaveLength(1);
  });

  it('saves birthDate only when the profile did not already have one', async () => {
    await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'new', educationLevel: 'elementary', birthDate: '2016-05-01', quizAnswers: [],
    });
    expect(db.profiles[0]!.birth_date).toBe('2016-05-01');
  });

  it('never overwrites an existing birthDate', async () => {
    db.profiles[0]!.birth_date = '2010-01-01';
    await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'new', educationLevel: 'elementary', birthDate: '2016-05-01', quizAnswers: [],
    });
    expect(db.profiles[0]!.birth_date).toBe('2010-01-01');
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

    // Complete placement, then the tree read (learn.ts) reflects it immediately.
    await auth(request(app).post(`/api/v1/placement/${COURSE_SLUG}/complete`)).send({
      claimedLevel: 'new', educationLevel: 'elementary', quizAnswers: [],
    });
    const treeRes = await auth(request(app).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(treeRes.status).toBe(200);
    expect(treeRes.body.data.course.placementRequired).toBe(false);
  });
});
