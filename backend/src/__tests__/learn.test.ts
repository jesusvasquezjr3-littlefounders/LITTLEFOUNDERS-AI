import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { COURSE_ID, COURSE_SLUG, LESSON_1_ID, LESSON_2_ID, makeDb } from './learnFixtures.js';

let db: FakeDb;
let userId: string;
let token: string;

beforeEach(() => {
  userId = '11111111-1111-4111-8111-111111111111';
  token = mintToken({ sub: userId });
  db = makeDb(userId);
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

describe('GET /api/v1/learn/courses', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/learn/courses');
    expect(res.status).toBe(401);
  });

  it('lists published courses with rollup progress for the caller', async () => {
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(200);
    expect(res.body.data.courses).toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        slug: COURSE_SLUG,
        title: { 'en-US': 'Financial Education' },
        lessonCount: 2,
        subject: 'money',
        badgeAsset: 'course-badges/financial-education.png',
        inProgress: false,
        adventureCount: 1,
        progress: { passed: 0, total: 2, pct: 0 },
      },
    ]);
  });

  /*
   * This handler re-lists CourseSummary's fields by hand instead of spreading
   * it, so adding a field to the summary does NOT serve it. `inProgress` was
   * computed correctly and dropped right here, and the "still being built"
   * badge never rendered in production — the frontend's own tests passed
   * because their fixtures already carried the field.
   */
  it('serves inProgress, which the card badge depends on', async () => {
    db.courses[0]!.in_progress = true;
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(200);
    expect(res.body.data.courses[0].inProgress).toBe(true);
  });

  it('502s when PostgREST is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(502);
  });

  /*
   * THE SHAPE OF THE READ, which is where /learn's 2.0-2.4 s lived.
   *
   * The handler used to await the whole adventures -> sagas -> topics ->
   * lessons -> progress chain once PER COURSE. Nothing asserted that, and the
   * fixture had a single course, so the per-course cost was invisible to the
   * suite by construction. A second course makes it measurable.
   */
  describe('reads the whole shelf one level at a time', () => {
    const SECOND_COURSE_ID = '44444444-4444-4444-8444-444444444444';

    function countingFetch(counts: Record<string, number>): typeof fetch {
      const real = createFakeFetch(db);
      return (async (input: RequestInfo | URL, init?: RequestInit) => {
        const table = String(input).split('/rest/v1/')[1]?.split('?')[0];
        if (table) counts[table] = (counts[table] ?? 0) + 1;
        return real(input, init);
      }) as typeof fetch;
    }

    beforeEach(() => {
      db.courses!.push({
        ...db.courses![0]!,
        id: SECOND_COURSE_ID,
        slug: 'second-course',
        title: { 'en-US': 'Second Course' },
      });
    });

    it('asks each level ONCE, however many courses are published', async () => {
      const counts: Record<string, number> = {};
      vi.stubGlobal('fetch', countingFetch(counts));

      const res = await auth(request(createApp()).get('/api/v1/learn/courses'));

      expect(res.status).toBe(200);
      expect(res.body.data.courses).toHaveLength(2);
      // One request per level for the whole shelf — not one chain per course.
      for (const table of ['adventures', 'sagas', 'topics', 'lessons', 'course_placements', 'placement_credits']) {
        expect(counts[table], `${table} was read ${counts[table]} time(s)`).toBe(1);
      }
    });

    it('still 502s when a level read fails — that is the content service, not one bad row', async () => {
      const real = createFakeFetch(db);
      vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/rest/v1/adventures')) return new Response('boom', { status: 500 });
        return real(input, init);
      }) as typeof fetch);

      const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
      expect(res.status).toBe(502);
    });
  });
});

describe('GET /api/v1/learn/courses/:slug/tree', () => {
  it('404s for an unknown course slug', async () => {
    const res = await auth(request(createApp()).get('/api/v1/learn/courses/does-not-exist/tree'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns the full tree with per-lesson unlock state and nextLessonId', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(res.status).toBe(200);
    const lessons = res.body.data.adventures[0].sagas[0].topics[0].lessons;
    expect(lessons.map((l: { id: string; state: string }) => [l.id, l.state])).toEqual([
      [LESSON_1_ID, 'current'],
      [LESSON_2_ID, 'locked'],
    ]);
    expect(res.body.data.nextLessonId).toBe(LESSON_1_ID);
    expect(res.body.data.adventures[0].state).toBe('available');
  });
});

describe('GET /api/v1/learn/lessons/:id', () => {
  it('404s for an unknown lesson', async () => {
    const res = await auth(request(createApp()).get('/api/v1/learn/lessons/00000000-0000-4000-8000-000000000000'));
    expect(res.status).toBe(404);
  });

  it('403s LESSON_LOCKED for a locked lesson', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_2_ID}`));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('LESSON_LOCKED');
  });

  it('serves the client-safe document with answers stripped from every segment', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    for (const segment of res.body.data.document.segments) {
      expect(segment).not.toHaveProperty('answer');
    }
    expect(res.body.data.lesson).toMatchObject({ id: LESSON_1_ID, slug: 'lesson-1', xp_total: 20 });
  });

  it('falls back to es-MX (authoring locale) when the caller locale has no document row', async () => {
    db.profiles[0]!.locale = 'pt-BR'; // no pt-BR lesson_documents row in the fixture
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.locale).toBe('es-MX');
  });
});

describe('POST /api/v1/learn/lessons/:id/grade', () => {
  it('400s on a malformed body', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('403s LESSON_LOCKED for a locked lesson', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_2_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    expect(res.status).toBe(403);
  });

  it('grades a correct quiz_mcq as a perfect score with reveal (score 100 always reveals)', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict).toMatchObject({ correct: true, score: 100, tier: 'perfect', allowRetry: false });
    expect(res.body.data.verdict.reveal).toEqual({ correct_option_id: 'a' });
  });

  it('grades a wrong quiz_mcq with per-distractor rationale feedback, no reveal on a non-final attempt', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict).toMatchObject({ correct: false, score: 0, tier: 'tryAgain', allowRetry: true });
    expect(res.body.data.verdict.feedback_md).toBe('because that is wrong');
    expect(res.body.data.verdict.reveal).toBeUndefined();
  });

  it('reveal gating: reveals + disallows retry on the final permitted attempt (max_attempts = 2)', async () => {
    const app = createApp();
    const first = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 1,
    });
    expect(first.body.data.verdict.reveal).toBeUndefined();
    expect(first.body.data.verdict.allowRetry).toBe(true);

    const second = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 2,
    });
    expect(second.status).toBe(200);
    expect(second.body.data.verdict.reveal).toEqual({ correct_option_id: 'a' });
    expect(second.body.data.verdict.allowRetry).toBe(false);
  });

  it('409s ATTEMPTS_EXHAUSTED once max_attempts is reached, and does not record a third attempt', async () => {
    const app = createApp();
    for (let i = 0; i < 2; i++) {
      await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
        segment_id: 'quiz-1',
        answer: { option_id: 'b' },
        attempt_number: i + 1,
      });
    }
    const third = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 3,
    });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('ATTEMPTS_EXHAUSTED');
    expect(db.lesson_segment_attempts).toHaveLength(2);
  });

  it('applies the hint penalty server-side to the recorded score (hint_penalty_pct 10)', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' }, // correct → raw 100
      attempt_number: 1,
      hints_used: 1, // 100 × 0.9 = 90
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict.score).toBe(90);
    expect(res.body.data.verdict.tier).toBe('great'); // penalized below 100 → not "perfect"
    const row = db.lesson_segment_attempts.find((r) => r.segment_id === 'quiz-1');
    expect(row?.score).toBe(90);
    expect(row?.hints_used).toBe(1);
  });

  it('records grade timing and closed pedagogical context for intelligence processing', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 1,
      time_spent_seconds: 42,
    });
    expect(res.status).toBe(200);
    const row = db.lesson_segment_attempts.find((attempt) => attempt.segment_id === 'quiz-1');
    expect(row).toMatchObject({
      time_spent_seconds: 42,
      course_id: COURSE_ID,
      skill_key: 'financial-education/topic-1',
      diagnostic_code: 'initial_incorrect',
    });
    expect(row?.document_updated_at).toBeDefined();
  });

  it('run-scopes the attempt cap: a fresh run_id starts every segment over', async () => {
    const app = createApp();
    const RUN_A = '11111111-1111-4111-8111-111111111111';
    const RUN_B = '22222222-2222-4222-8222-222222222222';
    for (let i = 0; i < 2; i++) {
      await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
        segment_id: 'quiz-1', answer: { option_id: 'b' }, attempt_number: i + 1, run_id: RUN_A,
      });
    }
    const exhausted = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 3, run_id: RUN_A,
    });
    expect(exhausted.status).toBe(409); // run A is spent
    const freshRun = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1, run_id: RUN_B,
    });
    expect(freshRun.status).toBe(200); // a new play-through starts fresh
    expect(freshRun.body.data.verdict.score).toBe(100);
  });

  it('422s UNSUPPORTED_SEGMENT for an ungraded (story) segment', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'story-1',
      answer: {},
      attempt_number: 1,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_SEGMENT');
  });

  it('grades a keyless memory_flip segment (no answer key) instead of 422', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'memory-1',
      answer: { flips: 6, pairs: 3 },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    // Completing the board is the win — memory_flip floors at 40.
    expect(res.body.data.verdict.score).toBeGreaterThanOrEqual(40);
  });

  it('404s for a segment id that does not exist in the document', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'nope',
      answer: {},
      attempt_number: 1,
    });
    expect(res.status).toBe(404);
  });

  it('scores a malformed answer as 0 rather than throwing', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { not_an_option_id: true },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict.score).toBe(0);
  });
});

describe('POST /api/v1/learn/lessons/:id/complete', () => {
  it('400s on an out-of-range minutes_spent', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 999 });
    expect(res.status).toBe(400);
  });

  it('recomputes the score server-side from recorded attempts (never trusts a client-reported score) and awards XP/streak', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });

    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      score: 100,
      passed: true,
      xp_earned: 20,
      xp_delta: 20,
      next_lesson_id: LESSON_2_ID,
    });
    expect(res.body.data.progress).toEqual({ passed: 1, total: 2, pct: 50 });

    const stats = db.learning_stats.find((s) => s.user_id === userId);
    expect(stats).toMatchObject({ xp_points: 20, lessons_completed: 1, minutes_learned: 5, streak_days: 1 });

    const progressRow = db.lesson_progress.find((p) => p.lesson_id === LESSON_1_ID);
    expect(progressRow).toMatchObject({ best_score: 100, passed: true, xp_earned: 20 });
  });

  it('ignores a client-supplied score entirely — score is 0 with zero recorded attempts', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 0, passed: false, xp_earned: 0, xp_delta: 0 });
  });

  it('is idempotent on xp_delta / lessons_completed once already passed', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 5 });

    const second = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 3 });
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ xp_delta: 0, passed: true });

    const stats = db.learning_stats.find((s) => s.user_id === userId);
    // minutes still accrue even when nothing was "newly passed"; xp/lessons_completed do not.
    expect(stats).toMatchObject({ xp_points: 20, lessons_completed: 1, minutes_learned: 8 });
  });

  it('403s LESSON_LOCKED for a locked lesson', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_2_ID}/complete`)).send({ minutes_spent: 1 });
    expect(res.status).toBe(403);
  });

  /*
   * Regression: completion is a read-modify-write over learning_stats. When the
   * READ failed transiently, supabaseRest collapsed the failure into a zeroed
   * row and the following PATCH wrote deltas-from-zero straight back — silently
   * erasing a learner's XP, minutes, lessons and BOTH streak columns behind a
   * 200 response. minutes_learned and the streaks exist nowhere else, so the
   * loss was permanent. The read must now be distinguishable from "no progress".
   */
  it('never overwrites accumulated stats when the learning_stats read fails transiently', async () => {
    const app = createApp();
    // A learner with real history.
    const existing = {
      user_id: userId, xp_points: 5000, minutes_learned: 300, lessons_completed: 40,
      streak_days: 12, longest_streak: 30, last_active_date: '2020-01-01', updated_at: '2020-01-01T00:00:00.000Z',
    };
    db.learning_stats = [{ ...existing }];

    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });

    // Fault ONLY the learning_stats GET; every other call still succeeds.
    const realFetch = createFakeFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/learning_stats') && method === 'GET') {
        return new Response('{"message":"no more connections allowed"}', { status: 503 });
      }
      return realFetch(input, init);
    }));

    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 5 });

    // Refuse rather than compute from assumed zeros.
    expect(res.status).toBe(502);
    // And crucially: the row is untouched.
    expect(db.learning_stats[0]).toMatchObject(existing);
  });

  it('a story-only lesson (no graded segments) scores 100 and PASSES on completion', async () => {
    const app = createApp();
    // Pass lesson-1 first to unlock the story-only lesson-2.
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60 });

    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_2_ID}/complete`)).send({ seconds_spent: 25 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 100, passed: true });

    const progressRow = db.lesson_progress.find((p) => p.lesson_id === LESSON_2_ID);
    expect(progressRow).toMatchObject({ best_score: 100, passed: true });
    const stats = db.learning_stats.find((s) => s.user_id === userId);
    expect(stats?.lessons_completed).toBe(2);
  });

  it('accepts seconds_spent and floors the accrued time at 1 minute per completion', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 20 });
    expect(res.status).toBe(200);
    const stats = db.learning_stats.find((s) => s.user_id === userId);
    expect(stats?.minutes_learned).toBe(1); // 20s rounds to 0 — the floor keeps a finished lesson from counting as no learning time
  });

  it('returns day-streak facts (streak_days / streak_extended / first_today) for the celebration screen', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 90 });
    expect(res.status).toBe(200);
    // Fixture stats were last touched in 2020 → this pass starts a fresh streak today.
    expect(res.body.data).toMatchObject({ streak_days: 1, streak_extended: true, first_today: true });
  });

  it('400s when neither seconds_spent nor minutes_spent is provided', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/learn/lessons/:id (audio manifest)', () => {
  it('includes Echo\'s narration manifest alongside the client-safe document', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.audio).toMatchObject({
      version: 1,
      units: { 'story-1.prompt': { url: 'http://filebase.test/files/abc' } },
    });
  });
});
