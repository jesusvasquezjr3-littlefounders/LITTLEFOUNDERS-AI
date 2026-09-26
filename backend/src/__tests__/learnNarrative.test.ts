import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';
import type { FakeDb } from './fakePostgrest.js';
import { createNarrativeFakeFetch } from './narrativeFakeRpc.js';

/*
 * S05.3c at the HTTP boundary: B.9 (decision journal), B.10 (guardian
 * narrative) and B.13 (family bridge), attacked with direct API requests from
 * every population. The UI never substitutes for any of these decisions.
 *
 * Populations: a parent-created 7-year-old (kid role, verified Tutor), the
 * under-13 refusal-path guest, an independent teen of 15, an adult learning for
 * themselves, the child's verified-parent Tutor, a second verified parent with
 * no link to the child, and a parent who never verified.
 *
 * Catalog, linear engine (the default until the owner accepts B.6):
 *   money / chapter 1 / arc A   story  (a story_branch lesson, kc.story)
 *                               save   (two story lessons, biz.saving-goal)
 *                               work   (one story lesson, biz.value-of-work)
 *   money / chapter 1 / arc B   later  (one story lesson, kc.story)
 *   other / chapter 1 / arc C   o1     (one story lesson)
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
const COURSE = { money: uid(1), other: uid(2) };

const storyDoc = (slug: string) => ({
  schema_version: 1,
  meta: { slug, title: slug, locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [{ id: 'story', type: 'story_scene', prompt_md: 'Story', difficulty: 1, xp: 0, payload: { backdrop: 'band', body_md: 'The end.' } }],
});

const branchDoc = {
  schema_version: 1,
  meta: { slug: 'story', title: 'Lemonade', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['liruf'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [{
    id: 'price', type: 'story_branch', title: 'How much to charge?', prompt_md: 'Choose a price', difficulty: 2, xp: 10,
    payload: {
      start_node: 'decision',
      nodes: [
        { id: 'decision', text_md: 'Each glass costs 2 coins to make. What price brings me closer to the guitar?', character: 'liruf', choices: [
          { id: 'p5', text_md: '5 coins, the usual', next: 'o5' },
          { id: 'p10', text_md: '10 coins, double the price', next: 'o10' },
        ] },
        { id: 'o5', text_md: 'The 6 neighbors buy. Liruf earns 18 coins.', choices: [{ id: 'fin5', text_md: 'Continue', next: null }] },
        { id: 'o10', text_md: 'Two neighbors buy. Liruf earns 16 coins.', choices: [{ id: 'fin10', text_md: 'Continue', next: null }] },
      ],
    },
  }],
};
const branchKeys = { price: { qualities: [{ node_id: 'decision', choice_id: 'p5', score: 100 }, { node_id: 'decision', choice_id: 'p10', score: 80 }, { node_id: 'o5', choice_id: 'fin5', score: 100 }, { node_id: 'o10', choice_id: 'fin10', score: 100 }] } };

interface Built { db: FakeDb; lesson: Record<string, string>; topic: Record<string, string> }

function build(): Built {
  const verified = (user_id: string) => ({ user_id, status: 'verified', method: 'local-ocr', birth_date: '1985-05-05' });
  const db: FakeDb = {
    courses: [], adventures: [], sagas: [], topics: [], lessons: [], lesson_documents: [], kc: [], topic_knowledge_components: [],
    course_placements: LEARNERS.flatMap((user_id) => [{ user_id, course_id: COURSE.money }, { user_id, course_id: COURSE.other }]),
    placement_credits: [], lesson_progress: [], lesson_segment_attempts: [], completed_course_badges: [], savings_goals: [], tasks: [], audit_logs: [],
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
      { user_id: TUTOR, display_name: 'Tutor', locale: 'pt-BR', birth_date: '1985-05-05' },
      { user_id: OTHER_PARENT, display_name: 'Other', locale: 'en-US', birth_date: '1985-05-05' },
      { user_id: UNVERIFIED_PARENT, display_name: 'Unverified', locale: 'en-US', birth_date: '1985-05-05' },
    ],
    learning_stats: LEARNERS.map((user_id) => ({ user_id, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null })),
    user_roles: [{ user_id: KID7, role: 'kid' }, { user_id: TUTOR, role: 'parent' }, { user_id: OTHER_PARENT, role: 'parent' }, { user_id: UNVERIFIED_PARENT, role: 'parent' }],
    parent_verifications: [verified(TUTOR), verified(OTHER_PARENT)],
    guardian_links: [{ parent_user_id: TUTOR, kid_user_id: KID7, verification_status: 'verified' }],
  };
  const lesson: Record<string, string> = {};
  const topic: Record<string, string> = {};
  const kcId = new Map<string, string>();
  let n = 1000;
  const kc = (key: string, title: Record<string, string>) => {
    if (!kcId.has(key)) {
      const id = uid(++n);
      kcId.set(key, id);
      db.kc!.push({ id, key, strand: 'money_life', title, objective: {}, tier_min: 1, p_l0: 0.2, p_t: 0.1, p_g: 0.2, p_s: 0.1, skill_key: null, status: key === 'biz.value-of-work' ? 'active' : 'draft' });
    }
    return kcId.get(key)!;
  };
  const addCourse = (course: keyof typeof COURSE, arcs: Array<{ topics: Array<{ key: string; kc: string; kcTitle: Record<string, string>; lessons: Array<{ key: string; doc?: object; keys?: object; xp?: number }> }> }>) => {
    db.courses!.push({ id: COURSE[course], slug: course, title: { 'en-US': course, 'pt-BR': `${course} (pt)` }, description: {}, subject: 'money', badge_asset: null, status: 'published', position: db.courses!.length + 1, requires: [] });
    const adventureId = uid(++n);
    db.adventures!.push({ id: adventureId, course_id: COURSE[course], position: 1, slug: `${course}-ch`, title: { 'en-US': 'Chapter' }, description: {}, theme: 't', status: 'published', age_tier: 'tier1', pathway_stage: null, eligibility_min_age: null, eligibility_max_age: null });
    arcs.forEach((arc, ai) => {
      const sagaId = uid(++n);
      db.sagas!.push({ id: sagaId, adventure_id: adventureId, position: ai + 1, slug: `arc${ai}`, title: {}, icon: 'x', status: 'published' });
      arc.topics.forEach((t, ti) => {
        const topicId = uid(++n);
        topic[t.key] = topicId;
        db.topics!.push({ id: topicId, saga_id: sagaId, position: ti + 1, slug: t.key, title: { 'en-US': `Topic ${t.key}`, 'pt-BR': `Tópico ${t.key}` }, status: 'published', kind: 'teaching', review_of: [], prerequisites: [], placement_probe: null });
        db.topic_knowledge_components!.push({ topic_id: topicId, kc_id: kc(t.kc, t.kcTitle), role: 'teaches', is_primary: true, map_version: 1 });
        t.lessons.forEach((l, li) => {
          const lessonId = uid(++n);
          lesson[l.key] = lessonId;
          db.lessons!.push({ id: lessonId, topic_id: topicId, position: li + 1, slug: l.key, title: { 'en-US': `Lesson ${l.key}`, 'pt-BR': `Lição ${l.key}` }, difficulty: 1, xp_total: l.xp ?? 0, estimated_minutes: 5, status: 'published' });
          db.lesson_documents!.push({ lesson_id: lessonId, locale: 'en-US', schema_version: 1, updated_at: '2026-09-01T00:00:00.000Z', document: l.doc ?? storyDoc(l.key), answer_keys: l.keys ?? {}, audio: {} });
        });
      });
    });
  };
  const story = { 'en-US': 'Setting a price', 'pt-BR': 'Definir um preço' };
  addCourse('money', [
    { topics: [
      { key: 'story', kc: 'kc.story', kcTitle: story, lessons: [{ key: 'story', doc: branchDoc, keys: branchKeys, xp: 10 }] },
      { key: 'save', kc: 'biz.saving-goal', kcTitle: { 'en-US': 'Saving toward a goal', 'pt-BR': 'Poupar para uma meta' }, lessons: [{ key: 'save1' }, { key: 'save2' }] },
      { key: 'work', kc: 'biz.value-of-work', kcTitle: { 'en-US': 'Work has value', 'pt-BR': 'O trabalho tem valor' }, lessons: [{ key: 'work1' }] },
    ] },
    { topics: [{ key: 'later', kc: 'kc.story', kcTitle: story, lessons: [{ key: 'later1' }] }] },
  ]);
  addCourse('other', [{ topics: [{ key: 'o1', kc: 'kc.o1', kcTitle: { 'en-US': 'Other' }, lessons: [{ key: 'o1' }] }] }]);
  return { db, lesson, topic };
}

let built: Built;
const as = (user: string, guest = false) => (req: request.Test) => req.set('Authorization', `Bearer ${mintToken({ sub: user, ...(guest ? { is_anonymous: true } : {}) })}`);
const get = (user: string, path: string) => as(user, user === GUEST)(request(createApp()).get(`/api/v1${path}`));
const post = (user: string, path: string, body: object = {}) => as(user, user === GUEST)(request(createApp()).post(`/api/v1${path}`).send(body));
const del = (user: string, path: string) => as(user, user === GUEST)(request(createApp()).delete(`/api/v1${path}`));
const grade = (user: string, choice: 'p5' | 'p10', attempt = 1) => post(user, `/learn/lessons/${built.lesson.story}/grade`, {
  segment_id: 'price', attempt_number: attempt, answer: { path: [{ node_id: 'decision', choice_id: choice }, { node_id: choice === 'p5' ? 'o5' : 'o10', choice_id: choice === 'p5' ? 'fin5' : 'fin10' }] },
});
const complete = (user: string, key: string) => post(user, `/learn/lessons/${built.lesson[key]}/complete`, { seconds_spent: 60 });
async function walk(user: string, keys: string[]) {
  for (const key of keys) {
    const res = await complete(user, key);
    expect(res.status, `${key}: ${JSON.stringify(res.body)}`).toBe(200);
  }
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

describe('B.9 — the decision journal records choices Core graded, never a client claim', () => {
  it('files the story decision with its question, the choice and the outcome the story showed', async () => {
    const res = await grade(KID7, 'p10');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(built.db.learner_decision_journal).toEqual([expect.objectContaining({
      user_id: KID7, course_id: COURSE.money, topic_id: built.topic.story, lesson_id: built.lesson.story, segment_id: 'price', decision_point: 'decision',
      segment_type: 'story_branch', situation_text: 'What price brings me closer to the guitar?', choice_id: 'p10', choice_text: '10 coins, double the price',
      outcome_text: 'Two neighbors buy. Liruf earns 16 coins.', first_choice_id: 'p10', times_decided: 1,
    })]);
    // The one-choice "Continue" node is not a decision; nothing numeric is stored.
    expect(JSON.stringify(built.db.learner_decision_journal)).not.toMatch(/"score"|quality/);
  });

  it('keeps the first choice when a replay changes it, and records nothing for a choice the lesson does not offer', async () => {
    await grade(KID7, 'p10');
    await grade(KID7, 'p5', 2);
    expect(built.db.learner_decision_journal).toEqual([expect.objectContaining({ first_choice_id: 'p10', choice_id: 'p5', times_decided: 2 })]);
    const forged = await post(TEEN15, `/learn/lessons/${built.lesson.story}/grade`, { segment_id: 'price', attempt_number: 1, answer: { path: [{ node_id: 'decision', choice_id: 'p99' }] } });
    expect(forged.status).toBe(200);
    expect(built.db.learner_decision_journal!.filter((r) => r.user_id === TEEN15)).toEqual([]);
  });

  it('resurfaces the decision in a later lesson of the same story arc, stable on reload, never in another course, and at most in three lessons', async () => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story']);
    const save1 = await get(KID7, `/learn/lessons/${built.lesson.save1}`);
    expect(save1.status).toBe(200);
    expect(save1.body.data.narrative_recall).toMatchObject({
      situation: 'What price brings me closer to the guitar?', choice: '10 coins, double the price', outcome: 'Two neighbors buy. Liruf earns 16 coins.',
      first_choice: null, relevance: 'same-arc', lesson_title: { 'en-US': 'Lesson story' },
    });
    const again = await get(KID7, `/learn/lessons/${built.lesson.save1}`);
    expect(again.body.data.narrative_recall.entry_id).toBe(save1.body.data.narrative_recall.entry_id);
    expect(built.db.learner_decision_resurfacings).toHaveLength(1);
    // Another course's lesson never echoes this course's story.
    expect((await get(KID7, `/learn/lessons/${built.lesson.o1}`)).body.data.narrative_recall).toBeUndefined();
    await walk(KID7, ['save1']);
    expect((await get(KID7, `/learn/lessons/${built.lesson.save2}`)).body.data.narrative_recall).toBeDefined();
    await walk(KID7, ['save2']);
    expect((await get(KID7, `/learn/lessons/${built.lesson.work1}`)).body.data.narrative_recall).toBeDefined();
    await walk(KID7, ['work1']);
    // Shares kc.story, but the entry has already been shown in three lessons.
    expect((await get(KID7, `/learn/lessons/${built.lesson.later1}`)).body.data.narrative_recall).toBeUndefined();
    expect(built.db.learner_decision_resurfacings).toHaveLength(3);
  });

  it('a learner reads and clears only their own journal; progress is untouched', async () => {
    await grade(KID7, 'p10');
    await grade(TEEN15, 'p5');
    const kid = await get(KID7, '/learn/journal');
    expect(kid.status).toBe(200);
    expect(kid.body.data.entries).toEqual([expect.objectContaining({
      course: { slug: 'money', title: expect.any(Object) }, lesson: { id: built.lesson.story, title: expect.any(Object) },
      situation: 'What price brings me closer to the guitar?', choice: '10 coins, double the price', firstChoice: null, resurfaced: 0,
    })]);
    expect(JSON.stringify(kid.body)).not.toContain('5 coins, the usual');
    expect((await del(TEEN15, '/learn/journal')).status).toBe(200);
    expect(built.db.learner_decision_journal!.map((r) => r.user_id)).toEqual([KID7]);
    expect(built.db.lesson_segment_attempts!.some((r) => r.user_id === TEEN15)).toBe(true);
    expect((await get(KID7, '/learn/journal?limit=0')).status).toBe(400);
  });

  it('before its migration exists, grading, opening and completing still work and nothing is echoed', async () => {
    vi.stubGlobal('fetch', createNarrativeFakeFetch(built.db, { missing: true }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await grade(KID7, 'p10')).status).toBe(200);
    expect((await complete(KID7, 'story')).status).toBe(200);
    const open = await get(KID7, `/learn/lessons/${built.lesson.save1}`);
    expect(open.status).toBe(200);
    expect(open.body.data.narrative_recall).toBeUndefined();
    await walk(KID7, ['save1', 'save2']);
    expect((await get(KID7, '/learn/journal')).status).toBe(502);
  });
});

describe('B.13 — a finished bridge topic prompts the right audience, and only that audience', () => {
  it('parent-created child: the guardian gets the prompt in the Family Hub; the child sees none and cannot act on it', async () => {
    await grade(KID7, 'p5');
    await walk(KID7, ['story', 'save1']);
    expect(built.db.learning_bridge_prompts ?? []).toEqual([]);
    const done = await complete(KID7, 'save2');
    expect(done.body.data.self_bridge).toBeUndefined();
    expect(built.db.learning_bridge_prompts).toEqual([expect.objectContaining({ learner_id: KID7, action: 'savings_goal', audience: 'guardian', status: 'open', topic_id: built.topic.save })]);
    const promptId = String(built.db.learning_bridge_prompts![0]!.id);
    expect((await get(KID7, '/learn/bridges')).body.data.prompts).toEqual([]);
    expect((await post(KID7, `/learn/bridges/${promptId}/act`)).status).toBe(404);
    expect((await post(KID7, `/learn/bridges/${promptId}/dismiss`)).status).toBe(404);
    expect((await get(KID7, `/family/learning/kids/${KID7}/bridges`)).status).toBe(403);
    const list = await get(TUTOR, `/family/learning/kids/${KID7}/bridges`);
    expect(list.status).toBe(200);
    // The skill is named in the guardian's own locale (pt-BR here).
    expect(list.body.data.prompts).toEqual([expect.objectContaining({ id: promptId, action: 'savings_goal', skill: 'Poupar para uma meta' })]);
  });

  it('the verified Tutor creates a REAL savings goal in one step; a replay creates nothing more; strangers get 404', async () => {
    await grade(KID7, 'p5');
    await walk(KID7, ['story', 'save1', 'save2']);
    const promptId = String(built.db.learning_bridge_prompts![0]!.id);
    const path = `/family/learning/kids/${KID7}/bridges/${promptId}/act`;
    expect((await post(TUTOR, path, { action: 'earning_task', title: 'Wash', rewardCoins: 5 })).status).toBe(400);
    expect((await post(OTHER_PARENT, path, { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' })).status).toBe(404);
    expect((await post(UNVERIFIED_PARENT, path, { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' })).body.error.code).toBe('PARENT_VERIFICATION_REQUIRED');
    expect((await post(TEEN15, path, { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' })).status).toBe(403);
    const acted = await post(TUTOR, path, { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' });
    expect(acted.status, JSON.stringify(acted.body)).toBe(201);
    expect(built.db.savings_goals).toEqual([expect.objectContaining({ kid_user_id: KID7, title: 'Bike', target: 120, icon: 'bike' })]);
    expect(acted.body.data).toMatchObject({ status: 'acted', replayed: false, goalId: built.db.savings_goals![0]!.id, taskId: null });
    expect(built.db.learning_bridge_prompts![0]).toMatchObject({ status: 'acted', closed_by: TUTOR, result_goal_id: built.db.savings_goals![0]!.id });
    const replay = await post(TUTOR, path, { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' });
    expect(replay.status).toBe(200);
    expect(replay.body.data.replayed).toBe(true);
    expect(built.db.savings_goals).toHaveLength(1);
    expect(built.db.audit_logs).toEqual([expect.objectContaining({ actor_id: TUTOR, action: 'learning_bridge.acted', subject: promptId })]);
    expect((await get(TUTOR, `/family/learning/kids/${KID7}/bridges`)).body.data.prompts).toEqual([]);
  });

  it('a task prompt creates a real task for the child; a dismissed prompt stays closed and never returns', async () => {
    await grade(KID7, 'p5');
    await walk(KID7, ['story', 'save1', 'save2', 'work1']);
    const byAction = (a: string) => built.db.learning_bridge_prompts!.find((p) => p.action === a)!;
    const task = byAction('earning_task');
    const created = await post(TUTOR, `/family/learning/kids/${KID7}/bridges/${task.id}/act`, { action: 'earning_task', title: 'Water the plants', rewardCoins: 10, recurrence: 'weekly' });
    expect(created.status).toBe(201);
    expect(built.db.tasks).toEqual([expect.objectContaining({ assigned_by: TUTOR, assigned_to: KID7, title: 'Water the plants', reward_coins: 10, recurrence: 'weekly' })]);
    expect(built.db.audit_logs!.map((r) => r.action).sort()).toEqual(['learning_bridge.acted', 'tasks.created']);
    const goal = byAction('savings_goal');
    expect((await post(TUTOR, `/family/learning/kids/${KID7}/bridges/${goal.id}/dismiss`)).status).toBe(200);
    const late = await post(TUTOR, `/family/learning/kids/${KID7}/bridges/${goal.id}/act`, { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('BRIDGE_CLOSED');
    expect(built.db.savings_goals).toEqual([]);
  });

  it('independent teen: a self-directed prompt that never creates a task or any wallet record', async () => {
    await grade(TEEN15, 'p5');
    await walk(TEEN15, ['story', 'save1']);
    const done = await complete(TEEN15, 'save2');
    expect(done.body.data.self_bridge).toEqual({ action: 'savings_goal' });
    const list = await get(TEEN15, '/learn/bridges');
    expect(list.body.data.prompts).toEqual([expect.objectContaining({ action: 'savings_goal', skill: { 'en-US': 'Saving toward a goal', 'pt-BR': 'Poupar para uma meta' } })]);
    const id = list.body.data.prompts[0].id as string;
    expect((await post(TEEN15, `/learn/bridges/${id}/act`, { title: 'Bike', target: 100 })).status).toBe(400);
    const acted = await post(TEEN15, `/learn/bridges/${id}/act`);
    expect(acted.status).toBe(200);
    expect(acted.body.data).toEqual({ status: 'acted', replayed: false });
    expect(built.db.tasks).toEqual([]);
    expect(built.db.savings_goals).toEqual([]);
    expect(built.db.learning_bridge_prompts![0]).toMatchObject({ audience: 'self', status: 'acted', result_task_id: null, result_goal_id: null });
    expect((await post(TEEN15, `/learn/bridges/${id}/act`)).body.data.replayed).toBe(true);
    // Family routes are guardian-only, whatever the teen sends.
    expect((await post(TEEN15, `/family/learning/kids/${TEEN15}/bridges/${id}/act`, { action: 'savings_goal', title: 'x', target: 1 })).status).toBe(403);
  });

  it('the database double refuses a task from a self prompt even if Core sent one', async () => {
    await grade(TEEN15, 'p5');
    await walk(TEEN15, ['story', 'save1', 'save2', 'work1']);
    const task = built.db.learning_bridge_prompts!.find((p) => p.action === 'earning_task')!;
    expect(task.audience).toBe('self');
    const raw = await fetch('http://supabase.test/rest/v1/rpc/act_on_learning_bridge_prompt', {
      method: 'POST', body: JSON.stringify({ p_prompt_id: task.id, p_actor_id: TEEN15, p_title: 'Mow', p_amount: 10, p_icon: null, p_recurrence: 'once' }),
    });
    expect(raw.status).toBe(400);
    expect(built.db.tasks).toEqual([]);
  });

  it.each([['adult learning for themselves', ADULT], ['verified-parent Tutor learning for themselves', TUTOR], ['refusal-path guest', GUEST]])('%s: no prompt is stored', async (_label, user) => {
    await grade(user, 'p5');
    await walk(user, ['story', 'save1', 'save2', 'work1']);
    expect(built.db.learning_bridge_prompts ?? []).toEqual([]);
    expect((await get(user, '/learn/bridges')).body.data.prompts).toEqual([]);
  });

  it('the pathway engine (B.6) finishes the same topic and offers the same prompt', async () => {
    process.env.COURSE_PATHWAY_ENGINE = 'pathway';
    resetConfigForTests();
    try {
      built.db.course_pathway_placements = [{ user_id: KID7, course_id: COURSE.money, pathway_stage: 'child', method: 'learner_chose_start', start_topic_id: null, credited_topics: 0 }];
      built.db.kc_edge = []; built.db.learner_kc_mastery = []; built.db.memory_card = []; built.db.course_pathway_badges = [];
      await grade(KID7, 'p5');
      await walk(KID7, ['story', 'save1', 'save2']);
      expect(built.db.learning_bridge_prompts).toEqual([expect.objectContaining({ learner_id: KID7, action: 'savings_goal', audience: 'guardian' })]);
      expect(built.db.learner_decision_journal).toHaveLength(1);
    } finally {
      delete process.env.COURSE_PATHWAY_ENGINE;
      resetConfigForTests();
    }
  });

  it('one prompt per component and one open prompt per action: replaying a finished topic never prompts again', async () => {
    await grade(KID7, 'p5');
    await walk(KID7, ['story', 'save1', 'save2']);
    await walk(KID7, ['save1', 'save2']);
    expect(built.db.learning_bridge_prompts).toHaveLength(1);
  });
});

describe('B.10 — the guardian narrative, through the verified-parent boundary', () => {
  it('names the lesson, the skills and the struggle in the guardian\'s locale, counts decisions, and never reveals a choice', async () => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story', 'save1']);
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.locale).toBe('pt-BR');
    expect(res.body.data.week).toEqual({ lessons: 2, topicsCompleted: 1 });
    const story = res.body.data.entries.find((e: { lessonId: string }) => e.lessonId === built.lesson.story);
    expect(story).toEqual({
      lessonId: built.lesson.story, lessonTitle: 'Lição story', topicTitle: 'Tópico story', courseTitle: 'money (pt)', completedAt: expect.any(String),
      skills: ['Definir um preço'], struggle: 'none', usedHint: false, decisions: 1, topicComplete: true, conversation: 'decision',
    });
    const save1 = res.body.data.entries.find((e: { lessonId: string }) => e.lessonId === built.lesson.save1);
    expect(save1).toMatchObject({ struggle: null, decisions: 0, topicComplete: false, conversation: 'explain', skills: ['Poupar para uma meta'] });
    // The child's own choice never crosses into the guardian's view.
    expect(JSON.stringify(res.body)).not.toMatch(/10 coins|double the price|Two neighbors/);
  });

  it('reports a mistake worked through from the graded attempts', async () => {
    built.db.lesson_documents!.find((d) => d.lesson_id === built.lesson.story)!.answer_keys = { price: { qualities: [{ node_id: 'decision', choice_id: 'p5', score: 100 }, { node_id: 'decision', choice_id: 'p10', score: 10 }] } };
    await grade(KID7, 'p10');
    await grade(KID7, 'p5', 2);
    await walk(KID7, ['story']);
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.body.data.entries[0]).toMatchObject({ struggle: 'resolved', decisions: 1 });
  });

  it.each([
    ['the child', KID7, 403],
    ['an independent teen', TEEN15, 403],
    ['a verified parent with no link to this child', OTHER_PARENT, 404],
    ['a parent who never verified', UNVERIFIED_PARENT, 403],
  ])('%s cannot read it', async (_label, user, status) => {
    await walk(KID7, []);
    const res = await get(user, `/family/learning/kids/${KID7}/narrative`);
    expect(res.status).toBe(status);
    expect(JSON.stringify(res.body)).not.toContain('entries');
  });

  it('pages through completions and refuses a malformed page', async () => {
    await grade(KID7, 'p5');
    await walk(KID7, ['story', 'save1', 'save2']);
    const first = await get(TUTOR, `/family/learning/kids/${KID7}/narrative?limit=2`);
    expect(first.body.data.entries).toHaveLength(2);
    expect(first.body.data.hasMore).toBe(true);
    const second = await get(TUTOR, `/family/learning/kids/${KID7}/narrative?limit=2&offset=2`);
    expect(second.body.data.entries).toHaveLength(1);
    expect(second.body.data.hasMore).toBe(false);
    expect((await get(TUTOR, `/family/learning/kids/${KID7}/narrative?limit=99`)).status).toBe(400);
    expect((await get(TUTOR, `/family/learning/kids/not-a-uuid/narrative`)).status).toBe(400);
  });
});
