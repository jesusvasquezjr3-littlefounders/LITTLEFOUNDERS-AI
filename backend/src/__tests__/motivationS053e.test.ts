import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';
import type { FakeDb, FakeRow } from './fakePostgrest.js';
import { createFakeFetch } from './fakePostgrest.js';
import { createNarrativeFakeFetch } from './narrativeFakeRpc.js';
import { LESSON_1_ID, makeDb } from './learnFixtures.js';
import { AUTONOMY_LEVERS, COSMETIC_PERSONALIZATION, pathChoice, paceStatus } from '../services/autonomy.js';
import { CELEBRATION_MILESTONES, badgeEarnedNow, completionCelebrations, courseCompletedNow } from '../services/celebrationBudget.js';
import { RECORDABLE_EVENTS, SERVER_ONLY_EVENTS } from '../services/insights.js';

/*
 * S05.3e at the HTTP boundary: B.20 (the celebration budget and informational
 * reward framing), B.21 (the habit streak with rest days and the guardian's
 * holiday pause), B.22 (no randomness on any reward path) and B.24 (the
 * learner's pace and path levers). Direct API requests from every population:
 * a parent-created 7-year-old (kid role, verified Tutor), the under-13
 * refusal-path guest, an independent teen of 15, an adult learning for
 * themselves, the child's verified-parent Tutor, a verified parent with no
 * link to the child, and a parent who never verified. The SQL twin of the
 * streak model is covered by database/scripts/test-habit-streak.sql over the
 * same shared vectors (physical PostgreSQL evidence is still open).
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
const ADULT = uid(105);
const TUTOR = uid(106);
const OTHER_PARENT = uid(107);
const UNVERIFIED_PARENT = uid(108);
const LEARNERS = [KID7, GUEST, TEEN15, ADULT, TUTOR];
const COURSE = uid(1);

// 2026-09-21 is a Monday.
const TODAY = '2026-09-24';

const storyDoc = (slug: string) => ({
  schema_version: 1,
  meta: { slug, title: slug, locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [{ id: 'story', type: 'story_scene', prompt_md: 'Story', difficulty: 1, xp: 0, payload: { backdrop: 'band', body_md: 'The end.' } }],
});

interface Built { db: FakeDb; lesson: Record<string, string> }

function build(): Built {
  const verified = (user_id: string) => ({ user_id, status: 'verified', method: 'local-ocr', birth_date: '1985-05-05' });
  const db: FakeDb = {
    courses: [{ id: COURSE, slug: 'money', title: { 'en-US': 'Money' }, description: {}, subject: 'money', badge_asset: null, status: 'published', position: 1, requires: [] }],
    adventures: [], sagas: [], topics: [], lessons: [], lesson_documents: [], kc: [], topic_knowledge_components: [],
    course_placements: LEARNERS.map((user_id) => ({ user_id, course_id: COURSE })),
    placement_credits: [], lesson_progress: [], lesson_segment_attempts: [], completed_course_badges: [], audit_logs: [],
    account_age_declarations: [
      { user_id: KID7, declared_age_band: 'under_13' },
      { user_id: TEEN15, declared_age_band: '13_to_17' },
      { user_id: ADULT, declared_age_band: 'adult' },
      { user_id: TUTOR, declared_age_band: 'adult' },
      { user_id: OTHER_PARENT, declared_age_band: 'adult' },
      { user_id: UNVERIFIED_PARENT, declared_age_band: 'adult' },
    ],
    account_safety_origins: [{ user_id: GUEST, under13_origin: true }],
    profiles: [
      { user_id: KID7, display_name: 'Kid', locale: 'en-US', birth_date: yearsAgo(7) },
      { user_id: GUEST, display_name: 'Guest', locale: 'en-US', birth_date: null },
      { user_id: TEEN15, display_name: 'Teen', locale: 'en-US', birth_date: yearsAgo(15) },
      { user_id: ADULT, display_name: 'Adult', locale: 'en-US', birth_date: null },
      { user_id: TUTOR, display_name: 'Tutor', locale: 'en-US', birth_date: '1985-05-05' },
      { user_id: OTHER_PARENT, display_name: 'Other', locale: 'en-US', birth_date: '1985-05-05' },
      { user_id: UNVERIFIED_PARENT, display_name: 'Unverified', locale: 'en-US', birth_date: '1985-05-05' },
    ],
    learning_stats: LEARNERS.map((user_id) => ({ user_id, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null })),
    user_roles: [
      { user_id: KID7, role: 'kid' }, { user_id: ADULT, role: 'universal' }, { user_id: TEEN15, role: 'universal' },
      { user_id: TUTOR, role: 'parent' }, { user_id: OTHER_PARENT, role: 'parent' }, { user_id: UNVERIFIED_PARENT, role: 'parent' },
    ],
    parent_verifications: [verified(TUTOR), verified(OTHER_PARENT)],
    guardian_links: [{ parent_user_id: TUTOR, kid_user_id: KID7, verification_status: 'verified' }],
  };
  const lesson: Record<string, string> = {};
  const adventureId = uid(500);
  const sagaId = uid(501);
  db.adventures!.push({ id: adventureId, course_id: COURSE, position: 1, slug: 'ch', title: { 'en-US': 'Chapter' }, description: {}, theme: 't', status: 'published', age_tier: 'tier1', pathway_stage: null, eligibility_min_age: null, eligibility_max_age: null });
  db.sagas!.push({ id: sagaId, adventure_id: adventureId, position: 1, slug: 'arc', title: {}, icon: 'x', status: 'published' });
  const topics = [
    { key: 'save', kc: 'biz.saving-goal', title: { 'en-US': 'Saving toward a goal', 'es-MX': 'Ahorrar para una meta' }, lessons: ['save1', 'save2', 'save3'] },
    { key: 'work', kc: 'biz.value-of-work', title: { 'en-US': 'Work has value' }, lessons: ['work1'] },
  ];
  let n = 600;
  topics.forEach((t, ti) => {
    const topicId = uid(++n);
    const kcId = uid(++n);
    db.kc!.push({ id: kcId, key: t.kc, strand: 'money_life', title: t.title, objective: {}, tier_min: 1, p_l0: 0.2, p_t: 0.1, p_g: 0.2, p_s: 0.1, skill_key: null, status: 'active' });
    db.topics!.push({ id: topicId, saga_id: sagaId, position: ti + 1, slug: t.key, title: { 'en-US': `Topic ${t.key}` }, status: 'published', kind: 'teaching', review_of: [], prerequisites: [], placement_probe: null });
    db.topic_knowledge_components!.push({ topic_id: topicId, kc_id: kcId, role: 'teaches', is_primary: true, map_version: 1 });
    t.lessons.forEach((key, li) => {
      const lessonId = uid(++n);
      lesson[key] = lessonId;
      db.lessons!.push({ id: lessonId, topic_id: topicId, position: li + 1, slug: key, title: { 'en-US': `Lesson ${key}` }, difficulty: 1, xp_total: 0, estimated_minutes: 5, status: 'published' });
      db.lesson_documents!.push({ lesson_id: lessonId, locale: 'en-US', schema_version: 1, updated_at: '2026-09-01T00:00:00.000Z', document: storyDoc(key), answer_keys: {}, audio: {} });
    });
  });
  return { db, lesson };
}

let built: Built;
const as = (user: string) => (req: request.Test) => req.set('Authorization', `Bearer ${mintToken({ sub: user, ...(user === GUEST ? { is_anonymous: true } : {}) })}`);
const get = (user: string, path: string) => as(user)(request(createApp()).get(`/api/v1${path}`));
const put = (user: string, path: string, body: object) => as(user)(request(createApp()).put(`/api/v1${path}`).send(body));
const post = (user: string, path: string, body: object = {}) => as(user)(request(createApp()).post(`/api/v1${path}`).send(body));
const del = (user: string, path: string) => as(user)(request(createApp()).delete(`/api/v1${path}`));
const complete = (user: string, key: string, localDate = TODAY) => post(user, `/learn/lessons/${built.lesson[key]}/complete`, { seconds_spent: 60, local_date: localDate });
const stats = (user: string): FakeRow => built.db.learning_stats!.find((row) => row.user_id === user)!;
const seedStreak = (user: string, row: Partial<FakeRow>) => Object.assign(stats(user), row);
async function events(name: string, wait = 50): Promise<FakeRow[]> {
  for (let i = 0; i < wait; i += 1) {
    await new Promise((done) => setTimeout(done, 5));
    const rows = (built.db.learning_events ?? []).filter((row) => row.event === name);
    if (rows.length) return rows;
  }
  return [];
}

beforeEach(() => {
  resetConfigForTests();
  built = build();
  vi.stubGlobal('fetch', createNarrativeFakeFetch(built.db));
});

afterEach(() => {
  resetConfigForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('B.20 — celebrations come only from the closed OD-7 list, and XP is paired with what was figured out', () => {
  it('an ordinary practised day celebrates the lesson only, and names the skill behind the XP', async () => {
    seedStreak(ADULT, { streak_days: 3, longest_streak: 3, last_active_date: '2026-09-23', days_practiced: 3 });
    const res = await complete(ADULT, 'save1');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.celebrations).toEqual(['lesson-complete']);
    expect(res.body.data.streak).toMatchObject({ model: 'rest-days-v1', outcome: 'extended', milestone: null, rest_days_left: 2 });
    expect(res.body.data.recognition).toEqual({ skills: ['Saving toward a goal'] });
    for (const milestone of res.body.data.celebrations) expect(CELEBRATION_MILESTONES).toContain(milestone);
  });

  it('the seventh practised day adds streak-7; a same-day second lesson adds nothing about the streak', async () => {
    seedStreak(TEEN15, { streak_days: 6, longest_streak: 6, last_active_date: '2026-09-23', days_practiced: 6 });
    const seventh = await complete(TEEN15, 'save1');
    expect(seventh.body.data.celebrations).toEqual(['lesson-complete', 'streak-7']);
    expect(seventh.body.data.streak).toMatchObject({ outcome: 'extended', milestone: 7 });
    const again = await complete(TEEN15, 'save2');
    expect(again.body.data.celebrations).toEqual(['lesson-complete']);
    expect(again.body.data.streak).toMatchObject({ outcome: 'same_day', milestone: null });
  });

  it('finishing the course celebrates course-complete and the badge once, never again on a replay', async () => {
    for (const key of ['save1', 'save2', 'save3']) expect((await complete(ADULT, key)).status).toBe(200);
    const last = await complete(ADULT, 'work1');
    expect(last.body.data.celebrations).toEqual(['lesson-complete', 'course-complete', 'badge-earned']);
    const replay = await complete(ADULT, 'work1');
    expect(replay.body.data.celebrations).toEqual(['lesson-complete']);
  });

  it('the pure budget: a failed run celebrates nothing, and nothing outside the list can be produced', () => {
    expect(completionCelebrations({ passed: false, streak: { milestone: 7 }, courseCompleted: true, badgeEarned: true })).toEqual([]);
    expect(completionCelebrations({ passed: true, streak: { milestone: 100 }, courseCompleted: false, badgeEarned: false })).toEqual(['lesson-complete', 'streak-100']);
    expect(CELEBRATION_MILESTONES).toEqual(['lesson-complete', 'course-complete', 'savings-goal-reached', 'badge-earned', 'streak-7', 'streak-30', 'streak-100']);
    const linear = (passed: number) => ({ course: { progress: { passed, total: 4 } } });
    expect(courseCompletedNow(linear(3), linear(4))).toBe(true);
    expect(courseCompletedNow(linear(4), linear(4))).toBe(false);
    expect(badgeEarnedNow(linear(3), null)).toBe(false);
    const pathway = (eligible: boolean, stages: string[]) => ({ course: { progress: { passed: 1, total: 1 } }, pathway: { progress: { passed: 1, total: 1, complete: eligible }, badge: { eligible, earnedStages: stages } } });
    expect(badgeEarnedNow(pathway(false, []), pathway(true, ['teen']))).toBe(true);
    expect(badgeEarnedNow(pathway(true, ['teen']), pathway(true, ['teen']))).toBe(false);
  });
});

describe('B.21 — the habit streak: rest days, a resting run, and the permanent best', () => {
  it('a missed day inside the week is a rest day, and a consenting learner records the Appendix C signal', async () => {
    seedStreak(ADULT, { streak_days: 4, longest_streak: 9, last_active_date: '2026-09-22', days_practiced: 20 });
    const res = await complete(ADULT, 'save1');
    expect(res.body.data).toMatchObject({ streak_days: 5, longest_streak: 9, streak_extended: true });
    expect(res.body.data.streak).toMatchObject({ outcome: 'bridged', rest_days_bridged: 1, rest_days_left: 1, days_practiced: 21, best: 9 });
    expect(stats(ADULT)).toMatchObject({ streak_days: 5, rest_days_used: 1, days_practiced: 21, last_active_date: TODAY });
    const rows = await events('streak_rest_day');
    expect(rows).toEqual([expect.objectContaining({ user_id: ADULT, value: 1, route_class: 'learn' })]);
  });

  it('never records the signal for a kid without guardian consent, nor for the refusal-path guest', async () => {
    seedStreak(KID7, { streak_days: 4, longest_streak: 4, last_active_date: '2026-09-22' });
    seedStreak(GUEST, { streak_days: 4, longest_streak: 4, last_active_date: '2026-09-22' });
    expect((await complete(KID7, 'save1')).body.data.streak.outcome).toBe('bridged');
    const guest = await complete(GUEST, 'save1');
    expect(guest.status).toBe(200);
    expect(guest.body.data.streak.outcome).toBe('bridged');
    await new Promise((done) => setTimeout(done, 60));
    expect((built.db.learning_events ?? []).filter((row) => row.event === 'streak_rest_day')).toEqual([]);
  });

  it('a third missed day rests the run: a new run starts at 1, the best stays, and the restart is recorded once', async () => {
    seedStreak(TEEN15, { streak_days: 6, longest_streak: 6, last_active_date: '2026-09-20', days_practiced: 10 });
    built.db.teen_analytics_preferences = [{ user_id: TEEN15, enabled: true, disclosure_version: 1 }];
    const res = await complete(TEEN15, 'save1');
    expect(res.body.data).toMatchObject({ streak_days: 1, longest_streak: 6 });
    expect(res.body.data.streak).toMatchObject({ outcome: 'restarted', best: 6, days_practiced: 11, run_before: 6 });
    expect(await events('streak_restart')).toEqual([expect.objectContaining({ user_id: TEEN15, value: 6 })]);
  });

  it('GET /learn/rhythm reads a broken run as resting with the best visible, and never rewrites the stored row (OD-9)', async () => {
    seedStreak(ADULT, { streak_days: 5, longest_streak: 12, last_active_date: '2026-09-18', days_practiced: 40 });
    const before = { ...stats(ADULT) };
    const res = await get(ADULT, `/learn/rhythm?local_date=${TODAY}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.streak).toMatchObject({ status: 'resting', current: 0, best: 12, daysPracticed: 40, restDaysLeft: 2, pause: null });
    expect(stats(ADULT)).toEqual(before);
    expect(res.body.data.levers).toEqual(['path', 'mentor', 'pace']);
    expect(JSON.stringify(res.body.data)).not.toMatch(/avatar/);
  });

  it('the three motivation signals are server-only: the client ingest drops a forged one', async () => {
    for (const event of ['streak_rest_day', 'streak_restart', 'path_choice']) {
      expect(RECORDABLE_EVENTS as readonly string[]).toContain(event);
      expect(SERVER_ONLY_EVENTS.has(event)).toBe(true);
    }
    const res = await as(ADULT)(request(createApp()).post('/api/v1/events'))
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36')
      .send({ events: [{ event: 'streak_rest_day', routeClass: 'learn', value: 2 }, { event: 'path_choice', routeClass: 'learn', value: 1 }] });
    expect(res.status).toBeLessThan(300);
    await new Promise((done) => setTimeout(done, 40));
    expect((built.db.learning_events ?? []).filter((row) => row.event === 'streak_rest_day' || row.event === 'path_choice')).toEqual([]);
  });

  it('refuses a malformed date and serves only the caller (no id in the path)', async () => {
    expect((await get(ADULT, '/learn/rhythm?local_date=2026-02-31')).status).toBe(400);
    expect((await get(ADULT, `/learn/rhythm?local_date=${TODAY}&user_id=${KID7}`)).status).toBe(400);
    expect((await as(ADULT)(request(createApp()).get('/api/v1/learn/rhythm'))).status).toBe(200);
    expect((await request(createApp()).get('/api/v1/learn/rhythm')).status).toBe(401);
  });

  it('onboarding day one uses the same model: a rest day keeps an earlier run', async () => {
    seedStreak(ADULT, { streak_days: 2, longest_streak: 2, last_active_date: '2026-09-22' });
    built.db.onboarding_responses = [];
    const res = await post(ADULT, '/onboarding/complete', { displayName: 'Ana', accountOfferChoice: 'later', localDate: TODAY });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.streakDays).toBe(3);
    expect(stats(ADULT)).toMatchObject({ streak_days: 3, rest_days_used: 1, xp_points: 0 });
  });
});

describe('B.21 — the verified guardian\'s holiday pause', () => {
  const path = `/family/learning/kids/${KID7}/streak-pause`;

  it('the child\'s verified Tutor pauses the streak; the holiday is neither practised nor missed', async () => {
    seedStreak(KID7, { streak_days: 8, longest_streak: 8, last_active_date: '2026-09-12', days_practiced: 8 });
    const set = await put(TUTOR, path, { starts_on: '2026-09-13', ends_on: '2026-09-23', local_date: '2026-09-17' });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(set.body.data.streak).toMatchObject({ status: 'paused', current: 8, pause: { startsOn: '2026-09-13', endsOn: '2026-09-23' } });
    expect(built.db.learning_streak_pauses).toEqual([expect.objectContaining({ learner_id: KID7, set_by: TUTOR, cancelled_at: null })]);
    expect(built.db.audit_logs).toContainEqual(expect.objectContaining({ actor_id: TUTOR, action: 'learning_streak.paused', subject: KID7 }));

    const kidView = await get(KID7, '/learn/rhythm?local_date=2026-09-20');
    expect(kidView.body.data.streak).toMatchObject({ status: 'paused', current: 8 });
    const back = await complete(KID7, 'save1', TODAY);
    expect(back.body.data.streak).toMatchObject({ outcome: 'extended', rest_days_bridged: 0 });
    expect(back.body.data.streak_days).toBe(9);
  });

  it('ending the pause keeps the days already paused and is audited', async () => {
    await put(TUTOR, path, { starts_on: '2026-09-20', ends_on: '2026-09-30', local_date: '2026-09-20' });
    const ended = await del(TUTOR, `${path}?local_date=${TODAY}`);
    expect(ended.status).toBe(200);
    expect(ended.body.data.status).toBe('cancelled');
    expect(built.db.learning_streak_pauses![0]).toMatchObject({ starts_on: '2026-09-20', ends_on: '2026-09-23', cancelled_at: null });
    expect(built.db.audit_logs).toContainEqual(expect.objectContaining({ action: 'learning_streak.pause_ended', subject: KID7 }));
  });

  it.each([
    ['a verified parent with no link to the child', OTHER_PARENT, 404],
    ['a parent who never verified', UNVERIFIED_PARENT, 403],
    ['the child', KID7, 403],
    ['an independent teen', TEEN15, 403],
    ['an adult learner', ADULT, 403],
    ['the refusal-path guest', GUEST, 403],
  ])('%s cannot pause, read or end the child\'s streak', async (_label, user, status) => {
    expect((await put(user, path, { starts_on: TODAY, ends_on: '2026-09-30', local_date: TODAY })).status).toBe(status);
    expect((await get(user, `/family/learning/kids/${KID7}/streak?local_date=${TODAY}`)).status).toBe(status);
    expect((await del(user, `${path}?local_date=${TODAY}`)).status).toBe(status);
    expect(built.db.learning_streak_pauses ?? []).toEqual([]);
  });

  it('refuses a pause longer than 21 days, backdated beyond a week, reversed, too far ahead, or with extra fields', async () => {
    for (const body of [
      { starts_on: TODAY, ends_on: '2026-10-15', local_date: TODAY },
      { starts_on: '2026-09-16', ends_on: '2026-09-20', local_date: TODAY },
      { starts_on: '2026-09-30', ends_on: '2026-09-29', local_date: TODAY },
      { starts_on: '2026-11-24', ends_on: '2026-11-30', local_date: TODAY },
      { starts_on: TODAY, ends_on: '2026-09-30', local_date: TODAY, learner_id: KID7 },
    ]) {
      expect((await put(TUTOR, path, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(built.db.learning_streak_pauses ?? []).toEqual([]);
  });

  it('the database refusal still holds if Core\'s own guard were bypassed', async () => {
    // The route's guardKid passes (a verified link exists), but the link is revoked before the RPC runs.
    const fetchWithRevocation = createNarrativeFakeFetch(built.db);
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('rpc/set_learning_streak_pause')) built.db.guardian_links = [];
      return fetchWithRevocation(input, init);
    }) as typeof fetch);
    const res = await put(TUTOR, path, { starts_on: TODAY, ends_on: '2026-09-30', local_date: TODAY });
    expect(res.status).toBe(404);
    expect(built.db.learning_streak_pauses ?? []).toEqual([]);
  });
});

describe('B.24 — the learner\'s own pace, and autonomy that is never an avatar', () => {
  it('the learner sets their own pace; today\'s passed lessons are compared with it', async () => {
    const set = await put(KID7, '/learn/pace', { daily_lesson_goal: 2, local_date: TODAY });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(set.body.data.pace).toEqual({ goal: 2, chosen: true, passedToday: 0, goalMet: false });
    expect(built.db.learning_pace_preferences).toEqual([expect.objectContaining({ user_id: KID7, daily_lesson_goal: 2 })]);
    const first = await complete(KID7, 'save1');
    expect(first.body.data.pace).toEqual({ goal: 2, chosen: true, passedToday: 1, goalMet: false });
    const second = await complete(KID7, 'save2');
    expect(second.body.data.pace).toEqual({ goal: 2, chosen: true, passedToday: 2, goalMet: true });
    // Reaching one's own plan is not on the celebration list.
    expect(second.body.data.celebrations).toEqual(['lesson-complete']);
    const rhythm = await get(KID7, `/learn/rhythm?local_date=${TODAY}`);
    expect(rhythm.body.data.pace).toEqual({ goal: 2, chosen: true, passedToday: 2, goalMet: true });
  });

  it('without a choice the plan is one lesson and is reported as not chosen', async () => {
    const rhythm = await get(TEEN15, `/learn/rhythm?local_date=${TODAY}`);
    expect(rhythm.body.data.pace).toEqual({ goal: 1, chosen: false, passedToday: 0, goalMet: false });
    expect(rhythm.body.data.mentor).toEqual({ character: 'rho', chosen: false });
  });

  it('refuses a pace outside 1-3, a string, extra fields, or a pace for someone else', async () => {
    for (const body of [{ daily_lesson_goal: 0 }, { daily_lesson_goal: 4 }, { daily_lesson_goal: '2' }, { daily_lesson_goal: 2, user_id: KID7 }, {}]) {
      expect((await put(ADULT, '/learn/pace', body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await as(ADULT)(request(createApp()).put(`/api/v1/learn/pace?user_id=${KID7}`).send({ daily_lesson_goal: 2 }))).status).toBe(400);
    expect(built.db.learning_pace_preferences ?? []).toEqual([]);
  });

  it('a guardian has no route to set the child\'s pace: it is the child\'s own lever', async () => {
    const res = await put(TUTOR, `/family/learning/kids/${KID7}/pace`, { daily_lesson_goal: 3 });
    expect(res.status).toBe(404);
    expect(built.db.learning_pace_preferences ?? []).toEqual([]);
  });

  it('the lever registry is path, Mentor and pace; cosmetic personalization is never a lever', () => {
    expect(AUTONOMY_LEVERS).toEqual(['path', 'mentor', 'pace']);
    for (const cosmetic of COSMETIC_PERSONALIZATION) expect(AUTONOMY_LEVERS as readonly string[]).not.toContain(cosmetic);
    expect(paceStatus({ daily_lesson_goal: 9 }, 5)).toMatchObject({ goal: 1 });
    const item = (lessonId: string) => ({ lessonId, topicId: 't', chapterId: 'c', reason: 'next' as const, access: 'pathway' as const });
    expect(pathChoice({ frontier: [item('a')], optional: [] }, 'a')).toBeNull();
    expect(pathChoice({ frontier: [item('a'), item('b')], optional: [] }, 'a')).toEqual({ exercised: false });
    expect(pathChoice({ frontier: [item('a')], optional: [{ ...item('c'), access: 'optional' as const }] }, 'c')).toEqual({ exercised: true });
    expect(pathChoice({ frontier: [item('a'), item('b')], optional: [] }, 'z')).toBeNull();
  });
});

describe('B.22 — no reward path consumes randomness', () => {
  let db: FakeDb;
  const user = '11111111-1111-4111-8111-111111111111';
  const token = mintToken({ sub: user });
  beforeEach(() => {
    db = makeDb(user);
    db.user_roles = [{ user_id: user, role: 'universal' }];
    vi.stubGlobal('fetch', createFakeFetch(db));
  });

  it('a completion, its XP, streak and celebrations are identical with Math.random disabled', async () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('B.22: a reward path asked for a random number'); });
    const app = createApp();
    await request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`).set('Authorization', `Bearer ${token}`)
      .send({ segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1, run_id: 'aaaaaaaa-0000-4000-8000-00000000b221' });
    const res = await request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`).set('Authorization', `Bearer ${token}`)
      .send({ seconds_spent: 60, run_id: 'aaaaaaaa-0000-4000-8000-00000000b221', local_date: TODAY });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toMatchObject({ passed: true, xp_delta: 20, celebrations: ['lesson-complete'], streak: { outcome: 'first' } });
    expect(random).not.toHaveBeenCalled();
  });

  it('a failed run pays nothing new and celebrates nothing', async () => {
    const app = createApp();
    await request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`).set('Authorization', `Bearer ${token}`)
      .send({ segment_id: 'quiz-1', answer: { option_id: 'b' }, attempt_number: 1, run_id: 'aaaaaaaa-0000-4000-8000-00000000b222' });
    const res = await request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`).set('Authorization', `Bearer ${token}`)
      .send({ seconds_spent: 60, run_id: 'aaaaaaaa-0000-4000-8000-00000000b222', local_date: TODAY });
    expect(res.body.data).toMatchObject({ passed: false, celebrations: [], streak: { outcome: 'not_practised' } });
    expect(res.body.data.recognition).toBeUndefined();
  });
});
