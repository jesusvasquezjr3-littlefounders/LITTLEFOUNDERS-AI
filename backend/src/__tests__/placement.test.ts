import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { PLACEMENT_RESULT_KEYS } from '../services/placementFraming.js';

import { USER_ID, COURSE_ID, T1, T2, T3, L1, L2, L3, COURSE_SLUG, makeDb } from './placementAuditFixtures.js';

let db: FakeDb;
let token: string;

beforeEach(() => {
  token = mintToken({ sub: USER_ID });
  db = makeDb();
  db.account_age_declarations = [{ user_id: USER_ID, declared_age_band: '13_to_17' }];
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
// `unknown` because several tests post a deliberately malformed body; supertest's
// .send() only accepts string | object.
const step = (body: unknown) => auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/step`)).send(body as string | object);
const commit = (body: unknown) => auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/commit`)).send(body as string | object);

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

/*
 * Found by adversarial review, 2026-08-30 (HIGH): a self-harm disclosure
 * typed during placement — the FIRST exchange a learner has with this
 * system — used to be indistinguishable, in every log and every response,
 * from Oracle's placement-intake endpoint simply being unreachable. These
 * assert the server-side visibility this fix adds, and that the CLIENT
 * response stays exactly as innocuous as it always was — a child is never
 * told their own words were flagged.
 */
describe('POST /api/v1/placement/:courseSlug/intake — a flagged utterance is logged, never surfaced to the client', () => {
  /** Stubs both PostgREST calls (via the shared fake) and Oracle's own endpoint. */
  function stubFetchWithOracle(oracleResponse: unknown) {
    const postgrest = createFakeFetch(db);
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/tutor/placement-intake')) {
        return new Response(JSON.stringify({ data: oracleResponse, error: null }), { status: 200 });
      }
      return postgrest(input, init);
    }) as typeof fetch);
  }

  beforeEach(() => {
    db.profiles[0]!.birth_date = '2000-01-01'; // 18+, so intake is offered.
  });

  it('logs a flagged utterance with the user id, and never puts it in the client response', async () => {
    stubFetchWithOracle({
      available: true,
      priorFraction: 0.3,
      reflection: 'Perfecto, empecemos.',
      source: 'fallback',
      flagged: { category: 'self_harm', severity: 'high' },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/intake`)).send({
      learnerText: 'no se nada de esto, la verdad ya no quiero vivir',
      neutralReflection: 'Perfecto, empecemos.',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ available: true, priorFraction: 0.3, reflection: 'Perfecto, empecemos.' });
    expect(Object.keys(res.body.data)).not.toContain('flagged');
    expect(Object.keys(res.body.data)).not.toContain('source');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`placement intake blocked a flagged utterance for user ${USER_ID}`),
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('self_harm'));
    errorSpy.mockRestore();
  });

  it('does not log anything for an ordinary, unflagged intake', async () => {
    stubFetchWithOracle({
      available: true,
      priorFraction: 0.6,
      reflection: 'Ya sabes bastante.',
      source: 'model',
      flagged: null,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/intake`)).send({
      learnerText: 'ya llevo un presupuesto y ahorro cada mes',
      neutralReflection: 'Perfecto, empecemos.',
    });

    expect(res.status).toBe(200);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  /*
   * Migration 0065 (/ORACLE.md §4.1b), closing the gap the section named
   * explicitly: "whether a flagged placement-intake utterance belongs in a
   * guardian-visible record ... is a separate schema decision ... A loud log
   * is the floor this fix guarantees, not the ceiling." Before this, a
   * flagged utterance here left NOTHING a guardian could ever query — only
   * the console.error the test above already covers. This proves the
   * SECOND half: a real, RLS-protected row a verified guardian can read.
   */
  it('also persists a guardian-visible placement safety flag when the utterance is flagged', async () => {
    stubFetchWithOracle({
      available: true,
      priorFraction: 0.3,
      reflection: 'Perfecto, empecemos.',
      source: 'fallback',
      flagged: { category: 'self_harm', severity: 'high' },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/intake`)).send({
      learnerText: 'no se nada de esto, la verdad ya no quiero vivir',
      neutralReflection: 'Perfecto, empecemos.',
    });

    expect(res.status).toBe(200);
    expect(db.tutor_placement_safety_flags).toEqual([
      expect.objectContaining({
        user_id: USER_ID,
        course_id: COURSE_ID,
        category: 'self_harm',
        severity: 'high',
      }),
    ]);
  });

  it('writes no placement safety flag for an ordinary, unflagged intake', async () => {
    stubFetchWithOracle({
      available: true,
      priorFraction: 0.6,
      reflection: 'Ya sabes bastante.',
      source: 'model',
      flagged: null,
    });

    await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/intake`)).send({
      learnerText: 'ya llevo un presupuesto y ahorro cada mes',
      neutralReflection: 'Perfecto, empecemos.',
    });

    expect(db.tutor_placement_safety_flags ?? []).toEqual([]);
  });

  /*
   * Found by adversarial review, round 40 (2026-08-30, HIGH): `IntakeBody`
   * used to accept a `birthDate` field that took priority over the profile's
   * own verified birth date — `parsed.data.birthDate ?? profiles[0]?.birth_date`.
   * A crafted request could fabricate an adult age for an account whose
   * REAL, on-file birth date belonged to a child under 12, bypassing the
   * §1.9 floor this endpoint exists to enforce and, as a direct consequence,
   * disabling `placementIntake.ts`'s fail-closed moderation guarantee for
   * that population. No legitimate caller ever sent this field — the
   * frontend only ever sends `{ learnerText, neutralReflection }`.
   */
  it('refuses a real under-12 profile even when the request tries to assert an adult age', async () => {
    db.profiles[0]!.birth_date = '2018-01-01'; // a real 8-year-old on file
    stubFetchWithOracle({
      available: true,
      priorFraction: 0.5,
      reflection: 'hola',
      source: 'model',
      flagged: null,
    });

    const res = await auth(request(createApp()).post(`/api/v1/placement/${COURSE_SLUG}/intake`)).send({
      learnerText: 'soy adulto de verdad',
      neutralReflection: 'ok',
      birthDate: '2000-01-01',
    });

    // The extra field is now rejected outright by .strict() — the important
    // assertion either way is that it can never grant access a real child's
    // own profile does not have.
    expect(res.body.data?.available ?? false).toBe(false);
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
    // B.15 (S05.3d): a closed accompaniment frame, and nothing that could rank the learner.
    expect(res.body.data.framing).toEqual({ path: 'learner_chose_start', start: 'beginning', basis: 'prior_exposure', learner_chosen: true });
    expect(Object.keys(res.body.data).sort()).toEqual([...PLACEMENT_RESULT_KEYS].sort());
  });

  it('lets a learner move themselves EARLIER than the quiz placed them', async () => {
    const { answers } = await playQuiz(new Set([T1, T2, T3]));
    const res = await commit({ signals: {}, answers, chosenFrontier: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.creditedLessonCount).toBe(1);
    expect(res.body.data.startLessonId).toBe(L2);
    expect(db.course_placements[0]).toMatchObject({ method: 'learner_adjusted' });
    expect(res.body.data.framing).toEqual({ path: 'learner_adjusted', start: 'further_in', basis: 'prior_exposure', learner_chosen: true });
    expect(Object.keys(res.body.data).sort()).toEqual([...PLACEMENT_RESULT_KEYS].sort());
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

  it('confirms the same placement on retry without writing a second row', async () => {
    await commit({ signals: {}, answers: [], startFromBeginning: true });
    const res = await commit({ signals: {}, answers: [], startFromBeginning: true });
    expect(res.status).toBe(201);
    expect(db.course_placements).toHaveLength(1);
  });

  it('rejects a different result after a successful commit', async () => {
    const { answers } = await playQuiz(new Set([T1, T2, T3]));
    expect((await commit({ signals: {}, answers })).status).toBe(201);
    const originalCredits = structuredClone(db.placement_credits);
    const response = await commit({ signals: {}, answers: [], startFromBeginning: true });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PLACEMENT_ALREADY_COMPLETE');
    expect(db.placement_credits).toEqual(originalCredits);
  });
  it('recovers from a lost commit response without duplicating credits', async () => {
    const { answers } = await playQuiz(new Set([T1, T2, T3]));
    const fake = createFakeFetch(db); let loseResponse = true;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const result = await fake(input, init);
      if (String(input).includes('/rpc/commit_course_placement') && loseResponse) {
        loseResponse = false;
        return new Response('Unavailable', { status: 503 });
      }
      return result;
    });
    expect((await commit({ signals: {}, answers })).status).toBe(502);
    expect(db.course_placements).toHaveLength(1);
    expect((await commit({ signals: {}, answers })).status).toBe(201);
    expect(db.placement_credits).toHaveLength(3);
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

describe('the entry placement is offered, never a wall (learn.ts)', () => {
  it('does not refuse lesson access before placement, reports placementRequired until it is done, then clears it', async () => {
    const app = createApp();

    // Before placing: a lesson is not refused by the placement, and the course still reports it as offered.
    const getRes = await auth(request(app).get(`/api/v1/learn/lessons/${L1}`));
    expect(getRes.body.error?.code).not.toBe('PLACEMENT_REQUIRED');

    const before = await auth(request(app).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(before.status).toBe(200);
    expect(before.body.data.course.placementRequired).toBe(true);

    await commit({ signals: {}, answers: [], startFromBeginning: true });

    const after = await auth(request(app).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(after.status).toBe(200);
    expect(after.body.data.course.placementRequired).toBe(false);
  });
});
