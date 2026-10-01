import { activateChoiceFixture } from './v2RuntimeFixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';
import type { FakeDb, FakeRow } from './fakePostgrest.js';
import { createFakeFetch } from './fakePostgrest.js';
import { consecutiveMisses, guidedReviewFor } from '../services/guidedReview.js';
import { registerFromEvidence } from '../services/learnerRegister.js';
import { LEARNER_REGISTER_POLICY_VERSION } from '../services/learnerRegisterPolicy.js';
import { ENGAGEMENT_HEALTH_METRICS, ENGAGEMENT_VOLUME_SIGNALS, TREND_MIN_WEEKLY_SAMPLE, classifyTrend, mayOptimizeFor } from '../services/engagementHealth.js';

/*
 * S05.3f at the HTTP boundary: B.23 (the learner's register comes from Core's
 * own age evidence, and the graduation moment is owed once, only after a
 * younger register) and B.26 with OD-1 (a miss costs nothing, and consecutive
 * misses on one skill earn the Mentor's guided-review offer, never a lock).
 * Direct API requests from every population: a parent-created 7-year-old and
 * 11-year-old (kid role, verified Tutor), the under-13 refusal-path guest (no
 * birth date), an independent teen of 15, an adult learning for themselves
 * and the verified parent (Tutor). The SQL functions are covered by
 * database/scripts/test-learner-wellbeing.sql (physical PostgreSQL evidence is
 * still open); the RPCs below are contract doubles.
 */

const uid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const yearsAgo = (years: number, days = 30): string => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const KID7 = uid(201);
const KID11 = uid(202);
const GUEST = uid(203);
const TEEN15 = uid(204);
const ADULT = uid(205);
const TUTOR = uid(206);
const LEARNERS = [KID7, KID11, GUEST, TEEN15, ADULT, TUTOR];
const COURSE = uid(1);


interface Built { db: FakeDb; lesson: Record<string, string> }

function build(): Built {
  const db: FakeDb = {
    courses: [{ id: COURSE, slug: 'money', title: { 'en-US': 'Money' }, description: {}, subject: 'money', badge_asset: null, status: 'published', position: 1, requires: [] }],
    adventures: [], sagas: [], topics: [], lessons: [], lesson_documents: [],
    course_placements: LEARNERS.map((user_id) => ({ user_id, course_id: COURSE })),
    placement_credits: [], lesson_progress: [], lesson_segment_attempts: [], completed_course_badges: [], audit_logs: [],
    account_age_declarations: [
      { user_id: KID7, declared_age_band: 'under_13' },
      { user_id: KID11, declared_age_band: 'under_13' },
      { user_id: TEEN15, declared_age_band: '13_to_17' },
      { user_id: ADULT, declared_age_band: 'adult' },
      { user_id: TUTOR, declared_age_band: 'adult' },
    ],
    account_safety_origins: [{ user_id: GUEST, under13_origin: true }],
    profiles: [
      { user_id: KID7, display_name: 'Kid', locale: 'en-US', birth_date: yearsAgo(7) },
      { user_id: KID11, display_name: 'Kid', locale: 'en-US', birth_date: yearsAgo(11) },
      { user_id: GUEST, display_name: 'Guest', locale: 'en-US', birth_date: null },
      { user_id: TEEN15, display_name: 'Teen', locale: 'en-US', birth_date: yearsAgo(15) },
      { user_id: ADULT, display_name: 'Adult', locale: 'en-US', birth_date: yearsAgo(30) },
      { user_id: TUTOR, display_name: 'Tutor', locale: 'en-US', birth_date: '1985-05-05' },
    ],
    mentor_age_calibrations: [],
    // KID7 chose Dina; everyone else keeps the catalog default.
    tutor_preferences: [{ user_id: KID7, character: 'dina', companion: null, diorama: 'diorama-a', backdrop: 'auto', nickname: null, adaptations: [], updated_at: '2026-09-01T00:00:00Z' }],
    learning_stats: LEARNERS.map((user_id) => ({ user_id, xp_points: 40, minutes_learned: 0, lessons_completed: 1, streak_days: 2, longest_streak: 2, last_active_date: null })),
    user_roles: [
      { user_id: KID7, role: 'kid' }, { user_id: KID11, role: 'kid' }, { user_id: ADULT, role: 'universal' },
      { user_id: TEEN15, role: 'universal' }, { user_id: TUTOR, role: 'parent' },
    ],
    parent_verifications: [{ user_id: TUTOR, status: 'verified', method: 'local-ocr', birth_date: '1985-05-05' }],
    guardian_links: [
      { parent_user_id: TUTOR, kid_user_id: KID7, verification_status: 'verified' },
      { parent_user_id: TUTOR, kid_user_id: KID11, verification_status: 'verified' },
    ],
    learner_register_history: [],
  };
  const lesson: Record<string, string> = {};
  const adventureId = uid(500);
  const sagaId = uid(501);
  db.adventures!.push({ id: adventureId, course_id: COURSE, position: 1, slug: 'ch', title: { 'en-US': 'Chapter' }, description: {}, theme: 't', status: 'published', age_tier: 'tier1', pathway_stage: null, eligibility_min_age: null, eligibility_max_age: null });
  db.sagas!.push({ id: sagaId, adventure_id: adventureId, position: 1, slug: 'arc', title: {}, icon: 'x', status: 'published' });
  const topics = [
    { key: 'save', title: { 'en-US': 'Saving toward a goal', 'es-MX': 'Ahorrar para una meta' }, lessons: ['save1', 'save2'] },
    { key: 'work', title: { 'en-US': 'Work has value' }, lessons: ['work1'] },
  ];
  let n = 600;
  topics.forEach((t, ti) => {
    const topicId = uid(++n);
    db.topics!.push({ id: topicId, saga_id: sagaId, position: ti + 1, slug: t.key, title: t.title, status: 'published', kind: 'teaching', review_of: [], prerequisites: [], placement_probe: null });
    t.lessons.forEach((key, li) => {
      const lessonId = uid(++n);
      lesson[key] = lessonId;
      db.lessons!.push({ id: lessonId, topic_id: topicId, position: li + 1, slug: key, title: { 'en-US': `Lesson ${key}` }, difficulty: 1, xp_total: 20, estimated_minutes: 5, status: 'published' });
      activateChoiceFixture(db, lessonId, ['q1', 'q2', 'q3', 'q4'], uid(++n));
    });
  });
  // Every lesson open, so the tests measure the offer, not unlock rules.
  db.lesson_progress = LEARNERS.flatMap((user_id) => ['save1', 'save2'].map((key) => ({ user_id, lesson_id: lesson[key], best_score: 100, passed: true, attempts: 1, xp_earned: 0 })));
  return { db, lesson };
}

/** Contract doubles for *_learner_registers.sql (the SQL is covered by its own script). */
function registerRpcs(db: FakeDb, base: typeof fetch): typeof fetch {
  const RANK: Record<string, number> = { young: 0, transition: 1, teen: 2, adult: 3 };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.slice(url.indexOf('/rest/v1/') + '/rest/v1/'.length).split('?')[0] ?? '';
    const history = (db.learner_register_history ??= []);
    if (path === 'rpc/note_learner_register') {
      const p = JSON.parse(String(init?.body)) as { p_user_id: string; p_register: string };
      if (!(p.p_register in RANK)) return reply(400, { code: '22023' });
      if (!history.some((row) => row.user_id === p.p_user_id && row.register === p.p_register)) {
        history.push({ user_id: p.p_user_id, register: p.p_register, first_seen_at: new Date().toISOString(), graduation_acknowledged_at: null });
      }
      const mine = history.filter((row) => row.user_id === p.p_user_id);
      return reply(200, { seen: mine.map((row) => row.register), acknowledged: mine.filter((row) => row.graduation_acknowledged_at).map((row) => row.register) });
    }
    if (path === 'rpc/acknowledge_learner_graduation') {
      const p = JSON.parse(String(init?.body)) as { p_user_id: string; p_register: string };
      if (p.p_register !== 'transition' && p.p_register !== 'teen') return reply(200, false);
      const mine = history.filter((row) => row.user_id === p.p_user_id);
      if (!mine.some((row) => RANK[row.register as string]! < RANK[p.p_register]!)) return reply(200, false);
      const row = mine.find((item) => item.register === p.p_register);
      if (!row) return reply(200, false);
      row.graduation_acknowledged_at ??= new Date().toISOString();
      return reply(200, true);
    }
    return base(input, init);
  }) as typeof fetch;
}

let built: Built;
const as = (user: string) => (req: request.Test) => req.set('Authorization', `Bearer ${mintToken({ sub: user, ...(user === GUEST ? { is_anonymous: true } : {}) })}`);
const get = (user: string, path: string) => as(user)(request(createApp()).get(`/api/v1${path}`));
const post = (user: string, path: string, body: object = {}) => as(user)(request(createApp()).post(`/api/v1${path}`).send(body));
const runs = new Map<string, { id: string; tokens: Record<string, string> }>();
const grade = async (user: string, key: string, segment: string, _attempt: number, optionId: 'a' | 'b', runId = uid(900)) => {
  segment = segment.length < 3 ? `step-${segment}` : segment;
  const path = `/learn/lessons/${built.lesson[key]}`;
  const identity = `${user}:${key}:${runId}`;
  let run = runs.get(identity);
  if (!run) {
    const started = await post(user, `${path}/v2-runs`);
    if (started.status !== 200) return started;
    run = { id: started.body.data.run_id, tokens: started.body.data.attempt_tokens };
    runs.set(identity, run);
  }
  const graded = await post(user, `${path}/grade`, { segment_id: segment, answer: { choice: optionId === 'a' ? 'save' : 'spend' }, attempt_token: run.tokens[segment], run_id: run.id });
  if (graded.body.data?.retry_attempt_token) run.tokens[segment] = graded.body.data.retry_attempt_token;
  return graded;
};
const stats = (user: string): FakeRow => built.db.learning_stats!.find((row) => row.user_id === user)!;

beforeEach(() => {
  resetConfigForTests();
  built = build();
  runs.clear();
  vi.stubGlobal('fetch', registerRpcs(built.db, createFakeFetch(built.db)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('B.23: the register comes from Core\'s age evidence', () => {
  it('resolves every population, never from role or the client', async () => {
    const expected: Array<[string, string, string]> = [
      [KID7, 'young', '6-9'], [KID11, 'transition', '10-12'], [GUEST, 'young', '6-9'],
      [TEEN15, 'teen', '13-17'], [ADULT, 'adult', 'adult'], [TUTOR, 'adult', 'adult'],
    ];
    for (const [user, register, band] of expected) {
      const res = await get(user, '/learn/register');
      expect(res.status, user).toBe(200);
      expect(res.body.data).toEqual({ register, copy_band: band, policy_version: LEARNER_REGISTER_POLICY_VERSION, graduation: null });
    }
    // Two kids share the kid role and read in different registers: age, not role.
    expect(built.db.learner_register_history!.filter((row) => row.user_id === KID7 || row.user_id === KID11).map((row) => row.register)).toEqual(['young', 'transition']);
  });

  it('reads the Mentor\'s first-write calibration for an under-13 learner with no birth date', async () => {
    built.db.mentor_age_calibrations = [{ user_id: GUEST, tier: 3 }];
    expect((await get(GUEST, '/learn/register')).body.data.register).toBe('transition');
    built.db.mentor_age_calibrations = [{ user_id: GUEST, tier: 2 }];
    expect((await get(GUEST, '/learn/register')).body.data.register).toBe('young');
  });

  it('refuses a client-stated band, an anonymous call and a failed evidence read', async () => {
    const smuggled = await get(TEEN15, '/learn/register?band=adult');
    expect(smuggled.status).toBe(400);
    expect((await request(createApp()).get('/api/v1/learn/register')).status).toBe(401);
    built.db.profiles = built.db.profiles!.filter((row) => row.user_id !== ADULT);
    const failed = await get(ADULT, '/learn/register');
    expect(failed.status).toBe(502);
    expect(built.db.learner_register_history!.some((row) => row.user_id === ADULT)).toBe(false);
  });

  it('owes the graduation once, only after a younger register, and only into the current one', async () => {
    // KID11 was seen at 9 (young) before this read.
    built.db.learner_register_history!.push({ user_id: KID11, register: 'young', first_seen_at: '2026-01-01T00:00:00Z', graduation_acknowledged_at: null });
    const owed = await get(KID11, '/learn/register');
    expect(owed.body.data.graduation).toEqual({ from: 'young', to: 'transition' });

    expect((await post(KID11, '/learn/register/graduation', { register: 'teen' })).status).toBe(404);
    expect((await post(KID11, '/learn/register/graduation', { register: 'transition', extra: true })).status).toBe(400);
    expect((await post(KID11, '/learn/register/graduation', { register: 'young' })).status).toBe(400);
    const ack = await post(KID11, '/learn/register/graduation', { register: 'transition' });
    expect(ack.status).toBe(200);
    expect(ack.body.data).toEqual({ acknowledged: true, register: 'transition' });
    expect((await get(KID11, '/learn/register')).body.data.graduation).toBeNull();
    // Idempotent: a retried acknowledgement keeps the first timestamp.
    const first = built.db.learner_register_history!.find((row) => row.user_id === KID11 && row.register === 'transition')!.graduation_acknowledged_at;
    expect((await post(KID11, '/learn/register/graduation', { register: 'transition' })).status).toBe(200);
    expect(built.db.learner_register_history!.find((row) => row.user_id === KID11 && row.register === 'transition')!.graduation_acknowledged_at).toBe(first);
  });

  it('owes no graduation to a learner who arrived in their register', async () => {
    await get(TEEN15, '/learn/register');
    expect((await post(TEEN15, '/learn/register/graduation', { register: 'teen' })).status).toBe(404);
    await get(KID7, '/learn/register');
    expect((await post(KID7, '/learn/register/graduation', { register: 'transition' })).status).toBe(404);
  });

  it('registerFromEvidence: a birth date wins, then the declaration, then the calibration, then the youngest', () => {
    const state = (ageBand: 'under_13' | '13_to_17' | 'adult' | null, protectedOrigin = false) => ({ required: ageBand === null, ageBand, protectedOrigin });
    const now = new Date('2026-09-24T00:00:00Z');
    expect(registerFromEvidence({ birthDate: '2016-09-24', state: state('under_13'), calibrationTier: null, now })).toBe('transition');
    expect(registerFromEvidence({ birthDate: '2016-09-25', state: state('under_13'), calibrationTier: null, now })).toBe('young');
    expect(registerFromEvidence({ birthDate: '2013-09-24', state: state('under_13'), calibrationTier: null, now })).toBe('teen');
    expect(registerFromEvidence({ birthDate: null, state: state('13_to_17'), calibrationTier: null, now })).toBe('teen');
    expect(registerFromEvidence({ birthDate: null, state: state('adult', true), calibrationTier: null, now })).toBe('young');
    expect(registerFromEvidence({ birthDate: null, state: state('under_13', true), calibrationTier: 3, now })).toBe('transition');
    expect(registerFromEvidence({ birthDate: 'not-a-date', state: state(null), calibrationTier: null, now })).toBe('young');
  });
});

describe('B.26 and OD-1: a miss costs nothing, consecutive misses earn a guided review', () => {
  it('offers the review on the third consecutive miss on the skill, across the lessons that teach it', async () => {
    const first = await grade(KID7, 'save1', 'q1', 1, 'b');
    const second = await grade(KID7, 'save1', 'q1', 2, 'b');
    expect(first.status).toBe(200);
    expect(first.body.data.guided_review).toBeUndefined();
    expect(second.body.data.guided_review).toBeUndefined();
    // A different lesson of the same topic: the skill is the same.
    const third = await grade(KID7, 'save2', 'q1', 1, 'b', uid(901));
    expect(third.status).toBe(200);
    expect(third.body.data.guided_review).toEqual({ skill_key: 'money/save', skill: 'Saving toward a goal', misses: 3, character: 'dina' });
    // Never a lock: the next attempt is graded as usual.
    const next = await grade(KID7, 'save2', 'q1', 2, 'a', uid(901));
    expect(next.status).toBe(200);
    expect(next.body.data.verdict.correct).toBe(true);
    expect(next.body.data.guided_review).toBeUndefined();
  });

  it('a met answer resets the run; the offer repeats only at the next multiple of the threshold', async () => {
    await grade(TEEN15, 'save1', 'q1', 1, 'b');
    await grade(TEEN15, 'save1', 'q1', 2, 'a');
    expect((await grade(TEEN15, 'save1', 'q2', 1, 'b')).body.data.guided_review).toBeUndefined();
    expect((await grade(TEEN15, 'save1', 'q2', 2, 'b')).body.data.guided_review).toBeUndefined();
    expect((await grade(TEEN15, 'save1', 'q3', 1, 'b')).body.data.guided_review).toMatchObject({ misses: 3 });
    expect((await grade(TEEN15, 'save1', 'q3', 2, 'b')).body.data.guided_review).toBeUndefined();
    expect((await grade(TEEN15, 'save1', 'q4', 1, 'b')).body.data.guided_review).toBeUndefined();
    expect((await grade(TEEN15, 'save1', 'q4', 2, 'b')).body.data.guided_review).toMatchObject({ misses: 6 });
  });

  it('counts only the caller\'s own misses on the same skill', async () => {
    await grade(ADULT, 'save1', 'q1', 1, 'b');
    await grade(ADULT, 'save1', 'q1', 2, 'b');
    // Another learner's misses and another skill's misses do not add up.
    expect((await grade(GUEST, 'save1', 'q2', 1, 'b')).status).toBe(403);
    await grade(ADULT, 'work1', 'q1', 1, 'b', uid(902));
    expect((await grade(ADULT, 'work1', 'q1', 2, 'b', uid(902))).body.data.guided_review).toBeUndefined();
    expect((await grade(ADULT, 'save1', 'q2', 1, 'b')).body.data.guided_review).toMatchObject({ skill_key: 'money/save', misses: 3 });
  });

  it('spends nothing: XP, streak and lessons are untouched by misses, for every learner population', async () => {
    for (const user of [KID7, KID11, TEEN15, ADULT, TUTOR]) {
      const before = { ...stats(user) };
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const res = await grade(user, 'save1', 'q1', attempt, 'b');
        expect(res.status, user).toBe(200);
      }
      const third = await grade(user, 'save1', 'q2', 1, 'b');
      expect(third.body.data.guided_review, user).toMatchObject({ misses: 3 });
      expect(stats(user)).toEqual(before);
    }
    // A client cannot forge the offer: the grade body has no such field, and extra fields are refused.
    const forged = await post(KID7, `/learn/lessons/${built.lesson.save1}/grade`, { segment_id: 'q3', answer: { option_id: 'a' }, attempt_number: 1, run_id: uid(900), guided_review: true });
    expect(forged.body.data?.guided_review).toBeUndefined();
  });

  it('consecutiveMisses and guidedReviewFor are pure', () => {
    expect(consecutiveMisses([false, false, true, false])).toBe(2);
    expect(consecutiveMisses([])).toBe(0);
    expect(guidedReviewFor({ outcomesNewestFirst: [false, false, false], skillKey: 'money/save', skill: null })).toEqual({ skill_key: 'money/save', skill: null, misses: 3, character: 'rho' });
    expect(guidedReviewFor({ outcomesNewestFirst: [false, false, false, false], skillKey: 'money/save', skill: null })).toBeNull();
    expect(guidedReviewFor({ outcomesNewestFirst: Array(15).fill(false), skillKey: 'money/save', skill: null })).toBeNull();
  });
});

describe('B.28: resolution efficiency, never engagement volume', () => {
  const week = (i: number) => new Date(Date.UTC(2026, 5, 1 + i * 7)).toISOString().slice(0, 10);
  const series = (values: number[], sample = 50) => values.map((value, i) => ({ week_start: week(i), value, sample }));

  it('a rising turn count is a regression, never engagement', () => {
    expect(classifyTrend(series([6, 6, 6, 6, 8, 8, 8, 8]), 'lower-is-better')).toBe('regression');
    expect(classifyTrend(series([8, 8, 8, 8, 6, 6, 6, 6]), 'lower-is-better')).toBe('improving');
    expect(classifyTrend(series([6, 6, 6, 6, 6.3, 6.3, 6.3, 6.3]), 'lower-is-better')).toBe('steady');
    expect(classifyTrend(series([0.6, 0.6, 0.6, 0.6, 0.45, 0.45, 0.45, 0.45]), 'higher-is-better')).toBe('regression');
    expect(classifyTrend(series([6, 6, 6, 8, 8, 8, 8]), 'lower-is-better')).toBe('insufficient_data');
    expect(classifyTrend(series([6, 6, 6, 6, 8, 8, 8, 8], TREND_MIN_WEEKLY_SAMPLE - 1), 'lower-is-better')).toBe('insufficient_data');
  });

  it('no volume signal may be an optimization target, and every Appendix C 1.2 metric has a direction', () => {
    for (const signal of ENGAGEMENT_VOLUME_SIGNALS) expect(mayOptimizeFor(signal), signal).toBe(false);
    expect(mayOptimizeFor(' Session_Length ')).toBe(false);
    expect(mayOptimizeFor('session_efficiency_ratio')).toBe(true);
    const byId = Object.fromEntries(ENGAGEMENT_HEALTH_METRICS.map((metric) => [metric.id, metric.direction]));
    expect(byId.session_efficiency_ratio).toBe('higher-is-better');
    expect(byId.mentor_resolution_turns).toBe('lower-is-better');
    expect(ENGAGEMENT_HEALTH_METRICS.every((metric) => mayOptimizeFor(metric.id))).toBe(true);
  });

  describe('the staff report', () => {
    const STAFF_ID = '22222222-2222-4222-8222-222222222222';
    const staff = mintToken({ sub: STAFF_ID });
    const base = () => [
      { name: 'practice_success_band_metrics', body: [] },
      { name: 'learning_judgment_differentiation', body: [] },
      { name: 'learning_replay_notice_display_rate', body: [{ below_best: 0, shown: 0, display_rate: null }] },
    ];
    const grant = (permissions: string[]) => {
      built.db.user_roles = [{ user_id: STAFF_ID, role: 'admin' }];
      built.db.admin_permissions = permissions.map((permission) => ({ user_id: STAFF_ID, permission }));
    };
    const report = (token = staff) => request(createApp()).get('/api/v1/admin/content/learning-quality?days=28').set('Authorization', `Bearer ${token}`);

    it('degrades to null before the migration, then flags rising Mentor turns as a regression', async () => {
      grant(['manage_content']);
      built.db.practice_difficulty_reviews = [];
      built.db.practice_difficulty_bands = [];
      built.db.practice_difficulty_band_log = [];
      built.db.__rpc = base();
      const pending = await report();
      expect(pending.status).toBe(200);
      expect(pending.body.data.engagementHealth).toBeNull();

      built.db.__rpc = [...base(),
        { name: 'learning_session_efficiency', body: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ week_start: week(i), learners: 60, graded_seconds: 3000, session_seconds: 5000, efficiency_ratio: '0.6000' })) },
        { name: 'mentor_resolution_efficiency', body: [0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [
          { week_start: week(i), intent: 'all', resolved_sessions: 40, median_turns: i < 4 ? '6.00' : '9.00', p75_turns: '12.00' },
          { week_start: week(i), intent: 'weak_skill', resolved_sessions: 12, median_turns: '7.00', p75_turns: '10.00' },
        ]) },
      ];
      const res = await report();
      expect(res.status).toBe(200);
      expect(res.body.data.engagementHealth.sessionEfficiency.trend).toBe('steady');
      expect(res.body.data.engagementHealth.mentorResolution.trend).toBe('regression');
      expect(res.body.data.engagementHealth.thresholds).toEqual({ windowWeeks: 4, tolerance: 0.1, minWeeklySample: TREND_MIN_WEEKLY_SAMPLE });
      for (const learner of LEARNERS) expect(JSON.stringify(res.body)).not.toContain(learner);
    });

    it('refuses a learner, a parent (Tutor), analytics-only staff and a guest', async () => {
      built.db.__rpc = base();
      built.db.user_roles = [{ user_id: KID7, role: 'kid' }, { user_id: TUTOR, role: 'parent' }];
      expect((await get(KID7, '/admin/content/learning-quality')).status).toBe(403);
      expect((await get(TUTOR, '/admin/content/learning-quality')).status).toBe(403);
      expect((await get(GUEST, '/admin/content/learning-quality')).status).toBe(403);
      grant(['view_analytics']);
      expect((await report()).status).toBe(403);
      expect(built.db.__rpc_calls ?? []).toHaveLength(0);
    });
  });
});
