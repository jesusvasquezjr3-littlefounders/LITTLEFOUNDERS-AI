import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { ipKeyGenerator } from 'express-rate-limit';
import { createApp } from '../app.js';
import { globalRateLimiter } from '../middleware/rateLimit.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';
import type { FakeDb } from './fakePostgrest.js';
import { v2PublicLessonSchema } from '../services/v2LessonDocument.js';
import { createNarrativeFakeFetch } from './narrativeFakeRpc.js';

/*
 * S05.3c at the HTTP boundary: B.9 (decision journal), B.10 (guardian
 * narrative) and B.13 (family bridge), attacked with direct API requests from
 * every population. The UI never substitutes for any of these decisions.
 *
 * Populations: a parent-created 7-year-old (kid role, verified Tutor), the
 * under-13 refusal-path guest, an independent teen of 15, a second independent
 * teen, a self-registered teen of 14 who later linked the same Tutor, an adult
 * learning for themselves, the child's verified-parent Tutor, a second verified
 * parent with no link to the child, and a parent who never verified.
 *
 * Owner answers (27 September 2026): L-12 (OD-28), an independent teen's "I
 * will try" creates their own savings goal; L-13 (OD-27 (3)), the verified
 * Tutor of a parent-created child under 13 sees which option the child chose in
 * each story decision, and every teen's journal stays private.
 *
 * Catalog, linear engine (the default until the owner accepts B.6):
 *   money / chapter 1 / arc A   story  (a signed v2 story choice, kc.story)
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

/** An ISO date exactly `years` years before today (UTC), shifted by `days`. */
const birthdayAgo = (years: number, days = 0): string => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const KID7 = uid(101);
const GUEST = uid(102);
const TEEN15 = uid(103);
const TEEN_B = uid(104);
const ADULT = uid(105);
const TUTOR = uid(106);
const OTHER_PARENT = uid(107);
const UNVERIFIED_PARENT = uid(108);
const LINKED_TEEN = uid(109);
const LEARNERS = [KID7, GUEST, TEEN15, TEEN_B, LINKED_TEEN, ADULT, TUTOR];
const COURSE = { money: uid(1), other: uid(2) };

const storyDoc = (slug: string) => ({
  schema_version: 2, title: slug, required_capabilities: ['visual.speech-plate.v1'],
  segments: [{ id: 'story', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Story', visual: { type: 'speech-plate' }, payload: { role: 'intro', line: 'The end.' } }],
});

const branchDoc = {
  schema_version: 2, title: 'Lemonade', required_capabilities: ['visual.story-scene.v1', 'operation.choose-option.v1'],
  segments: [{ id: 'price', type: 'story.branch.v2', grading: 'server', prompt: 'Choose a price', visual: { type: 'story-scene' },
    payload: { scene: 'Each glass costs 2 coins to make. What price brings me closer to the guitar?', options: [
      { id: 'p05', label: '5 coins, the usual' }, { id: 'p10', label: '10 coins, double the price' },
    ] } }],
};
const branchKeys = { price: { acceptable_choice_ids: ['p05', 'p10'] } };

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
      { user_id: TEEN_B, declared_age_band: '13_to_17' },
      { user_id: LINKED_TEEN, declared_age_band: '13_to_17' },
      { user_id: ADULT, declared_age_band: 'adult' },
      { user_id: TUTOR, declared_age_band: 'adult' },
      { user_id: OTHER_PARENT, declared_age_band: 'adult' },
      { user_id: UNVERIFIED_PARENT, declared_age_band: 'adult' },
    ],
    account_safety_origins: [{ user_id: GUEST, under13_origin: true }],
    // V2 admission needs a birth date; the sharing tests erase age evidence explicitly.
    profiles: [
      { user_id: KID7, display_name: 'Kid', locale: 'en-US', birth_date: yearsAgo(7) },
      { user_id: GUEST, display_name: 'Guest', locale: 'en-US', birth_date: yearsAgo(7) },
      { user_id: TEEN15, display_name: 'Teen', locale: 'en-US', birth_date: yearsAgo(15) },
      { user_id: TEEN_B, display_name: 'Teen B', locale: 'es-MX', birth_date: yearsAgo(15) },
      { user_id: LINKED_TEEN, display_name: 'Linked', locale: 'en-US', birth_date: yearsAgo(14) },
      { user_id: ADULT, display_name: 'Adult', locale: 'en-US', birth_date: yearsAgo(30) },
      { user_id: TUTOR, display_name: 'Tutor', locale: 'pt-BR', birth_date: '1985-05-05' },
      { user_id: OTHER_PARENT, display_name: 'Other', locale: 'en-US', birth_date: '1985-05-05' },
      { user_id: UNVERIFIED_PARENT, display_name: 'Unverified', locale: 'en-US', birth_date: '1985-05-05' },
    ],
    learning_stats: LEARNERS.map((user_id) => ({ user_id, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null })),
    user_roles: [{ user_id: KID7, role: 'kid' }, { user_id: TUTOR, role: 'parent' }, { user_id: OTHER_PARENT, role: 'parent' }, { user_id: UNVERIFIED_PARENT, role: 'parent' }],
    parent_verifications: [verified(TUTOR), verified(OTHER_PARENT)],
    guardian_links: [
      { parent_user_id: TUTOR, kid_user_id: KID7, verification_status: 'verified' },
      // A self-registered teen who invited the same Tutor later (no kid role).
      { parent_user_id: TUTOR, kid_user_id: LINKED_TEEN, verification_status: 'verified' },
    ],
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
          const versionId = uid(++n);
          (db.lesson_document_versions ??= []).push({ id: versionId, lesson_id: lessonId, locale: 'en-US', schema_version: 2, version_id: 'revision-001', created_at: '2026-09-01T00:00:00.000Z',
            document: { ...l.doc ?? storyDoc(l.key), course_id: COURSE[course], pathway_id: 'test-pathway', chapter_id: adventureId,
              lesson_id: lessonId, version_id: 'revision-001', locale: 'en-US', age_band: 'adult', eligibility: { minimum_age: 6, maximum_age: 119 },
              knowledge_component_ids: [t.kc], adventure_scene_id: 'diorama-a' }, answer_keys: l.keys ?? {}, audio: {} });
          (db.lesson_document_version_current ??= []).push({ lesson_id: lessonId, locale: 'en-US', document_version_id: versionId });
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
const runs = new Map<string, { runId: string; retryToken?: string }>();
const grade = async (user: string, choice: string, attempt = 1) => {
  const path = `/learn/lessons/${built.lesson.story}`;
  let run = attempt > 1 ? runs.get(user) : undefined;
  let attemptToken = run?.retryToken;
  if (!run || !attemptToken) {
    const started = await post(user, `${path}/v2-runs`);
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    run = { runId: started.body.data.run_id as string };
    attemptToken = started.body.data.attempt_tokens.price as string;
  }
  const result = await post(user, `${path}/grade`, { segment_id: 'price', run_id: run.runId, attempt_token: attemptToken, answer: { choice } });
  runs.set(user, { runId: run.runId, retryToken: result.body.data?.retry_attempt_token as string | undefined });
  return result;
};
const complete = async (user: string, key: string) => {
  const path = `/learn/lessons/${built.lesson[key]}`;
  let runId = key === 'story' ? runs.get(user)?.runId : undefined;
  if (!runId) {
    const started = await post(user, `${path}/v2-runs`);
    if (started.status !== 200) return started;
    runId = started.body.data.run_id as string;
    const viewed = await post(user, `${path}/v2-runs/${runId}/views`, { segment_id: 'story' });
    if (viewed.status !== 200) return viewed;
  }
  return post(user, `${path}/complete`, { run_id: runId, seconds_spent: 60 });
};
async function walk(user: string, keys: string[]) {
  for (const key of keys) {
    const res = await complete(user, key);
    expect(res.status, `${key}: ${JSON.stringify(res.body)}`).toBe(200);
  }
}

beforeEach(() => {
  // Each scenario is an independent journey; none may spend another's loopback rate budget.
  globalRateLimiter.resetKey(ipKeyGenerator('::ffff:127.0.0.1'));
  globalRateLimiter.resetKey('127.0.0.1');
  resetConfigForTests();
  built = build();
  runs.clear();
  for (const row of built.db.lesson_document_versions ?? []) {
    const parsed = v2PublicLessonSchema.safeParse(row.document);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  }
  vi.stubGlobal('fetch', createNarrativeFakeFetch(built.db));
});

afterEach(() => {
  resetConfigForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('B.9 — the decision journal records choices Core graded, never a client claim', () => {
  it('files the graded v2 story choice with its authored question and no invented outcome', async () => {
    const res = await grade(KID7, 'p10');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(built.db.learner_decision_journal).toEqual([expect.objectContaining({
      user_id: KID7, course_id: COURSE.money, topic_id: built.topic.story, lesson_id: built.lesson.story, segment_id: 'price', decision_point: 'choice',
      segment_type: 'story_branch', situation_text: 'What price brings me closer to the guitar?', choice_id: 'p10', choice_text: '10 coins, double the price',
      outcome_text: null, first_choice_id: 'p10', times_decided: 1,
    })]);
    // V2 records the offered choice only; nothing numeric or inferred is stored.
    expect(JSON.stringify(built.db.learner_decision_journal)).not.toMatch(/"score"|quality/);
  });

  it('keeps the first choice when a replay changes it, and records nothing for a choice the lesson does not offer', async () => {
    await grade(KID7, 'p10');
    await grade(KID7, 'p05', 2);
    expect(built.db.learner_decision_journal).toEqual([expect.objectContaining({ first_choice_id: 'p10', choice_id: 'p05', times_decided: 2 })]);
    const forged = await grade(TEEN15, 'p99');
    expect(forged.status).toBe(400);
    expect(forged.body.error.code).toBe('VALIDATION_ERROR');
    expect(built.db.lesson_v2_grade_receipts!.filter((r) => r.user_id === TEEN15)).toEqual([]);
    expect(built.db.learner_decision_journal!.filter((r) => r.user_id === TEEN15)).toEqual([]);
  });

  it('resurfaces the decision in a later lesson of the same story arc, stable on reload, never in another course, and at most in three lessons', async () => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story']);
    const save1 = await get(KID7, `/learn/lessons/${built.lesson.save1}`);
    expect(save1.status).toBe(200);
    expect(save1.body.data.narrative_recall).toMatchObject({
      situation: 'What price brings me closer to the guitar?', choice: '10 coins, double the price', outcome: null,
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
    await grade(TEEN15, 'p05');
    const kid = await get(KID7, '/learn/journal');
    expect(kid.status).toBe(200);
    expect(kid.body.data.entries).toEqual([expect.objectContaining({
      course: { slug: 'money', title: expect.any(Object) }, lesson: { id: built.lesson.story, title: expect.any(Object) },
      situation: 'What price brings me closer to the guitar?', choice: '10 coins, double the price', firstChoice: null, resurfaced: 0,
    })]);
    expect(JSON.stringify(kid.body)).not.toContain('5 coins, the usual');
    expect((await del(TEEN15, '/learn/journal')).status).toBe(200);
    expect(built.db.learner_decision_journal!.map((r) => r.user_id)).toEqual([KID7]);
    expect(built.db.lesson_v2_grade_receipts!.some((r) => r.user_id === TEEN15)).toBe(true);
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
    await grade(KID7, 'p05');
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
    await grade(KID7, 'p05');
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
    await grade(KID7, 'p05');
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

  it('independent teen: "I will try" alone is a commitment that creates no task and no wallet record', async () => {
    await grade(TEEN15, 'p05');
    await walk(TEEN15, ['story', 'save1']);
    const done = await complete(TEEN15, 'save2');
    expect(done.body.data.self_bridge).toEqual({ action: 'savings_goal' });
    const list = await get(TEEN15, '/learn/bridges');
    expect(list.body.data.prompts).toEqual([expect.objectContaining({ action: 'savings_goal', skill: { 'en-US': 'Saving toward a goal', 'pt-BR': 'Poupar para uma meta' } })]);
    const id = list.body.data.prompts[0].id as string;
    // Malformed goal details are refused before anything is read or written.
    for (const bad of [{ title: 'Bike' }, { title: '', target: 10 }, { title: 'Bike', target: 0 }, { title: 'Bike', target: 10, icon: 'car' }, { title: 'Bike', target: 10, recurrence: 'weekly' }]) {
      expect((await post(TEEN15, `/learn/bridges/${id}/act`, bad)).status, JSON.stringify(bad)).toBe(400);
    }
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

  it('OD-28 (L-12): an independent teen names a goal and it is created in their own wallet, once; a task prompt still takes no details', async () => {
    await grade(TEEN15, 'p05');
    await walk(TEEN15, ['story', 'save1', 'save2', 'work1']);
    const byAction = (a: string) => built.db.learning_bridge_prompts!.find((p) => p.action === a)!;
    const goalPrompt = byAction('savings_goal');
    const created = await post(TEEN15, `/learn/bridges/${goalPrompt.id}/act`, { title: 'New headphones', target: 300, icon: 'gift' });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(built.db.savings_goals).toEqual([expect.objectContaining({ kid_user_id: TEEN15, title: 'New headphones', target: 300, icon: 'gift', status: 'active' })]);
    const goalId = built.db.savings_goals![0]!.id;
    expect(created.body.data).toEqual({ status: 'acted', replayed: false, goalId });
    expect(byAction('savings_goal')).toMatchObject({ status: 'acted', result_goal_id: null, result_self_goal_id: goalId, result_task_id: null });
    expect(built.db.audit_logs).toEqual(expect.arrayContaining([expect.objectContaining({ actor_id: TEEN15, action: 'learning_bridge.self_goal_created', subject: goalPrompt.id })]));
    // A replay returns the same goal and creates nothing more.
    const replay = await post(TEEN15, `/learn/bridges/${goalPrompt.id}/act`, { title: 'Again', target: 5 });
    expect(replay.body.data).toEqual({ status: 'acted', replayed: true, goalId });
    expect(built.db.savings_goals).toHaveLength(1);
    // Tasks stay guardian-only (OD-3): the task prompt refuses details and creates nothing.
    const taskPrompt = byAction('earning_task');
    expect((await post(TEEN15, `/learn/bridges/${taskPrompt.id}/act`, { title: 'Mow', target: 10 })).status).toBe(400);
    expect(built.db.tasks).toEqual([]);
    // Nobody else can act on the teen's prompt, whatever they send.
    for (const user of [ADULT, KID7, TUTOR]) {
      expect((await post(user, `/learn/bridges/${taskPrompt.id}/act`, { title: 'x', target: 1 })).status).toBe(404);
      expect((await post(user, `/learn/bridges/${taskPrompt.id}/act`)).status).toBe(404);
    }
  });

  it('OD-28 (L-12): no wallet, no goal: the holder check at the moment of acting refuses and writes nothing', async () => {
    await grade(TEEN15, 'p05');
    await walk(TEEN15, ['story', 'save1', 'save2']);
    const prompt = built.db.learning_bridge_prompts![0]!;
    // Still a self audience for Core (no kid role, no guardian), but public.teen_wallet_holder() refuses a parent account.
    built.db.user_roles!.push({ user_id: TEEN15, role: 'parent' });
    const refused = await post(TEEN15, `/learn/bridges/${prompt.id}/act`, { title: 'Bike', target: 10 });
    expect(refused.status, JSON.stringify(refused.body)).toBe(409);
    expect(refused.body.error.code).toBe('WALLET_UNAVAILABLE');
    expect(built.db.savings_goals).toEqual([]);
    expect(prompt.status).toBe('open');
  });

  it('the database double refuses a task from a self prompt even if Core sent one', async () => {
    await grade(TEEN15, 'p05');
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
    await grade(user, 'p05');
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
      await grade(KID7, 'p05');
      await walk(KID7, ['story', 'save1', 'save2']);
      expect(built.db.learning_bridge_prompts).toEqual([expect.objectContaining({ learner_id: KID7, action: 'savings_goal', audience: 'guardian' })]);
      expect(built.db.learner_decision_journal).toHaveLength(1);
    } finally {
      delete process.env.COURSE_PATHWAY_ENGINE;
      resetConfigForTests();
    }
  });

  it('OD-9 4.2: a migrated child is offered no bridge until the Tutor gives that specific consent', async () => {
    built.db.legacy_consent_subjects = [{ user_id: KID7, age_class: 'under_13', released_at: null }];
    built.db.data_practice_consents = [{ subject_user_id: KID7, practice_key: 'analytics.motivation_events', revoked_at: null }];
    await grade(KID7, 'p05');
    await walk(KID7, ['story', 'save1', 'save2']);
    expect(built.db.learning_bridge_prompts ?? []).toEqual([]);
    // The learning itself is untouched: the topic still completes and the journal still records (its own practice aside).
    expect((built.db.lesson_progress ?? []).some((r) => r.user_id === KID7)).toBe(true);
  });

  it('OD-9 4.2: with the specific consent, a migrated child is offered the bridge as before', async () => {
    built.db.legacy_consent_subjects = [{ user_id: KID7, age_class: 'under_13', released_at: null }];
    built.db.data_practice_consents = [{ subject_user_id: KID7, practice_key: 'sharing.learning_family_bridge', revoked_at: null }];
    await grade(KID7, 'p05');
    await walk(KID7, ['story', 'save1', 'save2']);
    expect(built.db.learning_bridge_prompts).toEqual([expect.objectContaining({ learner_id: KID7, action: 'savings_goal', audience: 'guardian' })]);
  });

  it('one prompt per component and one open prompt per action: replaying a finished topic never prompts again', async () => {
    await grade(KID7, 'p05');
    await walk(KID7, ['story', 'save1', 'save2']);
    await walk(KID7, ['save1', 'save2']);
    expect(built.db.learning_bridge_prompts).toHaveLength(1);
  });
});

describe('B.10 — the guardian narrative, through the verified-parent boundary', () => {
  it('names the lesson, the skills and the struggle in the guardian\'s locale and counts decisions; for a child under 13 it adds the chosen option (L-13), minimized', async () => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story', 'save1']);
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.locale).toBe('pt-BR');
    expect(res.body.data.week).toEqual({ lessons: 2, topicsCompleted: 1 });
    const story = res.body.data.entries.find((e: { lessonId: string }) => e.lessonId === built.lesson.story);
    // The per-entry shape is unchanged (the Family Hub client validates it strictly).
    expect(story).toEqual({
      lessonId: built.lesson.story, lessonTitle: 'Lição story', topicTitle: 'Tópico story', courseTitle: 'money (pt)', completedAt: expect.any(String),
      skills: ['Definir um preço'], struggle: 'none', usedHint: false, decisions: 1, topicComplete: true, conversation: 'decision',
    });
    const save1 = res.body.data.entries.find((e: { lessonId: string }) => e.lessonId === built.lesson.save1);
    expect(save1).toMatchObject({ struggle: null, decisions: 0, topicComplete: false, conversation: 'explain', skills: ['Poupar para uma meta'] });
    // L-13: the question and the option chosen, in the LESSON's locale; nothing more.
    expect(res.body.data.choicesVisible).toBe(true);
    expect(res.body.data.choices).toEqual([{
      lessonId: built.lesson.story, situation: 'What price brings me closer to the guitar?', choice: '10 coins, double the price', locale: 'en-US',
    }]);
    expect(JSON.stringify(res.body)).not.toMatch(/Two neighbors|timesDecided|firstChoice|resurfaced/);
  });

  it('L-13: after a changed replay the Tutor sees the latest option only, never the first one', async () => {
    await grade(KID7, 'p10');
    await grade(KID7, 'p05', 2);
    await walk(KID7, ['story']);
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.body.data.choices).toEqual([expect.objectContaining({ choice: '5 coins, the usual' })]);
    expect(JSON.stringify(res.body)).not.toContain('double the price');
  });

  const expectCountsOnly = (body: { data: Record<string, unknown> }) => {
    expect(body.data.choicesVisible).toBe(false);
    expect(body.data).not.toHaveProperty('choices');
    expect(JSON.stringify(body)).not.toMatch(/guitar|10 coins|double the price|Two neighbors/);
  };

  it.each([
    ['a parent-created child who is 13 by birth date', () => { built.db.profiles!.find((r) => r.user_id === KID7)!.birth_date = birthdayAgo(13); }],
    ['a parent-created child aged 13 by birth date even though the age screen said under 13', () => {
      built.db.profiles!.find((r) => r.user_id === KID7)!.birth_date = yearsAgo(14);
    }],
    ['a parent-created child with no age evidence at all', () => {
      built.db.profiles!.find((r) => r.user_id === KID7)!.birth_date = null;
      built.db.account_age_declarations = built.db.account_age_declarations!.filter((r) => r.user_id !== KID7);
    }],
  ])('L-13, counts only: %s', async (_label, arrange) => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story']);
    arrange();
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.entries[0]).toMatchObject({ decisions: 1, conversation: 'decision' });
    expectCountsOnly(res.body);
  });

  it('L-13 boundary: the choices are shown the day before the 13th birthday and private from that birthday on (computed at read time)', async () => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story']);
    const profile = built.db.profiles!.find((r) => r.user_id === KID7)!;
    profile.birth_date = birthdayAgo(13, 1);
    expect((await get(TUTOR, `/family/learning/kids/${KID7}/narrative`)).body.data.choicesVisible).toBe(true);
    expect((await get(KID7, '/learn/journal')).body.data.sharedWithTutor).toBe(true);
    profile.birth_date = birthdayAgo(13);
    expectCountsOnly((await get(TUTOR, `/family/learning/kids/${KID7}/narrative`)).body);
    expect((await get(KID7, '/learn/journal')).body.data.sharedWithTutor).toBe(false);
  });

  it('L-13: a parent-created child with no birth date but an under-13 age screen counts as under 13', async () => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story']);
    built.db.profiles!.find((r) => r.user_id === KID7)!.birth_date = null;
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.body.data.choices).toEqual([expect.objectContaining({ choice: '10 coins, double the price' })]);
  });

  it('L-13: a self-registered teen who linked the same Tutor keeps a private journal (counts only)', async () => {
    await grade(LINKED_TEEN, 'p10');
    await walk(LINKED_TEEN, ['story']);
    const res = await get(TUTOR, `/family/learning/kids/${LINKED_TEEN}/narrative`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.entries[0]).toMatchObject({ decisions: 1 });
    expectCountsOnly(res.body);
    expect((await get(LINKED_TEEN, '/learn/journal')).body.data.sharedWithTutor).toBe(false);
  });

  it('L-13: a cleared journal is gone for the Tutor too', async () => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story']);
    expect((await del(KID7, '/learn/journal')).status).toBe(200);
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.body.data).toMatchObject({ choicesVisible: true, choices: [] });
    expect(res.body.data.entries[0]).toMatchObject({ decisions: 0 });
  });

  it('reports a mistake worked through from the graded attempts', async () => {
    built.db.lesson_document_versions!.find((d) => d.lesson_id === built.lesson.story)!.answer_keys = { price: { acceptable_choice_ids: ['p05'] } };
    await grade(KID7, 'p10');
    await grade(KID7, 'p05', 2);
    await walk(KID7, ['story']);
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/narrative`);
    expect(res.body.data.entries[0]).toMatchObject({ struggle: 'resolved', decisions: 1 });
  });

  it.each([
    ['the child', KID7, 403],
    ['an independent teen', TEEN15, 403],
    ['a verified parent with no link to this child', OTHER_PARENT, 404],
    ['a parent who never verified', UNVERIFIED_PARENT, 403],
  ])('%s cannot read it, nor the choices a child under 13 made', async (_label, user, status) => {
    await grade(KID7, 'p10');
    await walk(KID7, ['story']);
    const res = await get(user, `/family/learning/kids/${KID7}/narrative`);
    expect(res.status).toBe(status);
    expect(JSON.stringify(res.body)).not.toMatch(/entries|choices|guitar|10 coins/);
  });

  it('pages through completions and refuses a malformed page', async () => {
    await grade(KID7, 'p05');
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

describe('OD-27 (3), L-13 — the verified Tutor sees an under-13 child\'s chosen options; a teen\'s journal stays private', () => {
  const KID_TEEN = uid(109);
  const KID_UNKNOWN = uid(110);
  const addKid = (id: string, birth: string | null, band: string) => {
    built.db.user_roles!.push({ user_id: id, role: 'kid' });
    built.db.profiles!.push({ user_id: id, display_name: 'Kid', locale: 'en-US', birth_date: birth });
    built.db.account_age_declarations!.push({ user_id: id, declared_age_band: band });
    built.db.guardian_links!.push({ parent_user_id: TUTOR, kid_user_id: id, verification_status: 'verified' });
    built.db.course_placements!.push({ user_id: id, course_id: COURSE.money });
    built.db.learning_stats!.push({ user_id: id, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null });
  };

  it('the Tutor reads the chosen option and the situation, in the Tutor\'s locale, minimised and audited', async () => {
    await grade(KID7, 'p10');
    const res = await get(TUTOR, `/family/learning/kids/${KID7}/decisions`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toEqual({
      locale: 'pt-BR', hasMore: false,
      entries: [{ id: expect.any(String), courseTitle: 'money (pt)', lessonTitle: 'Lição story', situation: 'What price brings me closer to the guitar?',
        choice: '10 coins, double the price', recordedAt: expect.any(String) }],
    });
    // Never the outcome, the first choice or anything scored.
    expect(JSON.stringify(res.body)).not.toMatch(/outcome|first|score|neighbors/i);
    expect(built.db.audit_logs).toEqual(expect.arrayContaining([expect.objectContaining({ actor_id: TUTOR, action: 'learner_journal.guardian_read', subject: KID7 })]));
    // The child is told on their own journal.
    expect((await get(KID7, '/learn/journal')).body.data.sharedWithTutor).toBe(true);
  });

  it('a teen\'s journal stays private: a parent-created teen and a self-registered teen alike', async () => {
    addKid(KID_TEEN, yearsAgo(14), '13_to_17');
    const denied = await get(TUTOR, `/family/learning/kids/${KID_TEEN}/decisions`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('JOURNAL_PRIVATE');
    expect((await get(KID_TEEN, '/learn/journal')).body.data.sharedWithTutor).toBe(false);
    expect((await get(TEEN15, '/learn/journal')).body.data.sharedWithTutor).toBe(false);
    expect((await get(ADULT, '/learn/journal')).body.data.sharedWithTutor).toBe(false);
  });

  it('age follows age: without a birth date the screened band decides, and an unknown age stays private', async () => {
    addKid(KID_UNKNOWN, null, 'under_13');
    expect((await get(TUTOR, `/family/learning/kids/${KID_UNKNOWN}/decisions`)).status).toBe(200);
    built.db.account_age_declarations = built.db.account_age_declarations!.filter((r) => r.user_id !== KID_UNKNOWN);
    built.db.account_age_declarations.push({ user_id: KID_UNKNOWN, declared_age_band: '13_to_17' });
    expect((await get(TUTOR, `/family/learning/kids/${KID_UNKNOWN}/decisions`)).status).toBe(403);
  });

  it('every other population is refused at the server', async () => {
    await grade(KID7, 'p10');
    expect((await get(OTHER_PARENT, `/family/learning/kids/${KID7}/decisions`)).status).toBe(404);
    const unverified = await get(UNVERIFIED_PARENT, `/family/learning/kids/${KID7}/decisions`);
    expect(unverified.status).toBe(403);
    expect(unverified.body.error.code).toBe('PARENT_VERIFICATION_REQUIRED');
    for (const user of [KID7, TEEN15, ADULT]) expect((await get(user, `/family/learning/kids/${KID7}/decisions`)).status).toBe(403);
    expect((await get(TUTOR, `/family/learning/kids/${KID7}/decisions?limit=99`)).status).toBe(400);
    expect((await get(TUTOR, '/family/learning/kids/not-a-uuid/decisions')).status).toBe(400);
    expect(built.db.audit_logs!.filter((r) => r.action === 'learner_journal.guardian_read')).toEqual([]);
  });
});
