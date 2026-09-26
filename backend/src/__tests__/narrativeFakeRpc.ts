import { randomUUID } from 'node:crypto';
import { createFakeFetch, type FakeDb, type FakeRow } from './fakePostgrest.js';

/*
 * S05.3c test double: the five narrative/bridge functions of
 * `*_learning_decision_journal.sql` and `*_learning_family_bridge.sql`, mirrored in memory on top of
 * the shared fake PostgREST. Contract double only, like the other RPC doubles:
 * it reproduces the refusals and state transitions Core relies on (lesson in
 * topic in course, audience vs guardian links, one prompt per component, one
 * open prompt per action, cooldown, expiry, replay, "a self prompt creates
 * nothing"), not PostgreSQL's locking. Physical-database evidence is open.
 *
 * `missing` simulates a deploy that ran before the migration: every narrative
 * RPC and table answers 404, as PostgREST does for an unknown relation.
 */

const NARRATIVE_TABLES = ['learner_decision_journal', 'learner_decision_resurfacings', 'learning_bridge_prompts'];

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DAY = 24 * 60 * 60 * 1000;
const GOAL_ICONS = ['star', 'game', 'toy', 'book', 'bike', 'trip', 'gift'];

export function createNarrativeFakeFetch(db: FakeDb, options: { missing?: boolean } = {}): typeof fetch {
  const base = createFakeFetch(db);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.slice(url.indexOf('/rest/v1/') + '/rest/v1/'.length).split('?')[0] ?? '';
    const method = (init?.method ?? 'GET').toUpperCase();
    const narrativeRpc = ['rpc/record_learner_decisions', 'rpc/offer_learning_bridge_prompt', 'rpc/act_on_learning_bridge_prompt', 'rpc/dismiss_learning_bridge_prompt'];
    if (options.missing && (narrativeRpc.includes(path) || NARRATIVE_TABLES.includes(path))) {
      return reply(404, { code: '42P01', message: 'relation does not exist' });
    }
    if (path === 'rpc/record_lesson_grade' && method === 'POST') {
      // The shared double omits created_at, which the real column always has
      // (DEFAULT now()); the guardian narrative orders attempts by it.
      const response = await base(input, init);
      let tick = 0;
      for (const row of db.lesson_segment_attempts ?? []) row.created_at ??= new Date(Date.now() + tick++).toISOString();
      return response;
    }
    if (method !== 'POST' || !narrativeRpc.includes(path)) return base(input, init);
    const p = JSON.parse(String(init?.body)) as FakeRow;
    const guardians = (learner: unknown) => (db.guardian_links ?? []).filter((l) => l.kid_user_id === learner && l.verification_status === 'verified');

    if (path === 'rpc/record_learner_decisions') {
      const decisions = p.p_decisions as FakeRow[];
      if (!Array.isArray(decisions) || decisions.length === 0 || decisions.length > 12) return reply(400, { message: '1 to 12 decisions required' });
      const lesson = (db.lessons ?? []).find((l) => l.id === p.p_lesson_id);
      const topic = (db.topics ?? []).find((t) => t.id === lesson?.topic_id);
      const saga = (db.sagas ?? []).find((s) => s.id === topic?.saga_id);
      const adventure = (db.adventures ?? []).find((a) => a.id === saga?.adventure_id);
      if (!lesson || topic?.id !== p.p_topic_id || adventure?.course_id !== p.p_course_id) return reply(400, { message: 'lesson is not in that topic and course' });
      const journal = db.learner_decision_journal ??= [];
      const now = new Date().toISOString();
      for (const d of decisions) {
        for (const key of ['situation_text', 'choice_text']) {
          const text = String(d[key] ?? '');
          if (text.length < 1 || text.length > 280) return reply(400, { message: `${key} violates its CHECK` });
        }
        const existing = journal.find((j) => j.user_id === p.p_user_id && j.lesson_id === p.p_lesson_id && j.segment_id === d.segment_id && j.decision_point === d.decision_point);
        if (existing) {
          Object.assign(existing, { segment_type: d.segment_type, locale: p.p_locale, situation_text: d.situation_text, choice_id: d.choice_id,
            choice_text: d.choice_text, outcome_text: d.outcome_text ?? null, times_decided: Number(existing.times_decided) + 1, recorded_at: now });
        } else {
          journal.push({ id: randomUUID(), user_id: p.p_user_id, course_id: p.p_course_id, topic_id: p.p_topic_id, lesson_id: p.p_lesson_id,
            segment_id: d.segment_id, decision_point: d.decision_point, segment_type: d.segment_type, locale: p.p_locale,
            situation_text: d.situation_text, first_choice_id: d.choice_id, first_choice_text: d.choice_text, choice_id: d.choice_id,
            choice_text: d.choice_text, outcome_text: d.outcome_text ?? null, times_decided: 1, first_recorded_at: now, recorded_at: now });
        }
      }
      return reply(200, decisions.length);
    }

    const prompts = db.learning_bridge_prompts ??= [];
    if (path === 'rpc/offer_learning_bridge_prompt') {
      if (p.p_audience !== 'guardian' && p.p_audience !== 'self') return reply(400, { message: 'unknown audience' });
      const hasGuardian = guardians(p.p_learner_id).length > 0;
      if ((p.p_audience === 'guardian') !== hasGuardian) return reply(200, { offered: false, reason: 'audience' });
      const now = Date.now();
      for (const row of prompts) {
        if (row.learner_id === p.p_learner_id && row.status === 'open' && Date.parse(String(row.expires_at)) <= now) {
          Object.assign(row, { status: 'expired', closed_at: row.expires_at });
        }
      }
      for (const c of p.p_candidates as FakeRow[]) {
        if (c.action !== 'savings_goal' && c.action !== 'earning_task') continue;
        const kc = (db.kc ?? []).find((k) => k.key === c.kc_key && k.status !== 'retired');
        if (!kc) continue;
        const mine = prompts.filter((row) => row.learner_id === p.p_learner_id);
        if (mine.some((row) => row.kc_id === kc.id)) continue;
        if (mine.some((row) => row.action === c.action && (row.status === 'open' || Date.parse(String(row.created_at)) > now - Number(p.p_cooldown_days) * DAY))) continue;
        const id = randomUUID();
        prompts.push({ id, learner_id: p.p_learner_id, kc_id: kc.id, action: c.action, audience: p.p_audience, course_id: p.p_course_id,
          topic_id: p.p_topic_id, lesson_id: p.p_lesson_id, status: 'open', created_at: new Date(now).toISOString(),
          expires_at: new Date(now + Number(p.p_ttl_days) * DAY).toISOString(), closed_at: null, closed_by: null, result_task_id: null, result_goal_id: null });
        return reply(200, { offered: true, prompt_id: id, action: c.action, kc_key: c.kc_key });
      }
      return reply(200, { offered: false, reason: 'none_eligible' });
    }

    const prompt = prompts.find((row) => row.id === p.p_prompt_id);
    if (!prompt) return reply(200, { status: 'not_found' });
    const allowed = prompt.audience === 'guardian'
      ? guardians(prompt.learner_id).some((l) => l.parent_user_id === p.p_actor_id)
      : p.p_actor_id === prompt.learner_id;
    if (!allowed) return reply(200, { status: 'forbidden' });

    if (path === 'rpc/dismiss_learning_bridge_prompt') {
      if (prompt.status === 'dismissed') return reply(200, { status: 'dismissed', replayed: true });
      if (prompt.status !== 'open') return reply(200, { status: 'closed' });
      Object.assign(prompt, { status: 'dismissed', closed_at: new Date().toISOString(), closed_by: p.p_actor_id });
      return reply(200, { status: 'dismissed', replayed: false });
    }

    // act_on_learning_bridge_prompt
    if (prompt.status === 'acted') return reply(200, { status: 'acted', replayed: true, task_id: prompt.result_task_id, goal_id: prompt.result_goal_id });
    if (prompt.status !== 'open' || Date.parse(String(prompt.expires_at)) <= Date.now()) return reply(200, { status: 'closed' });
    const title = String(p.p_title ?? '').trim();
    let taskId: string | null = null;
    let goalId: string | null = null;
    if (prompt.audience === 'self') {
      if (p.p_title !== null || p.p_amount !== null || p.p_icon !== null || p.p_recurrence !== null) return reply(400, { message: 'a self prompt creates nothing' });
    } else if (prompt.action === 'savings_goal') {
      const amount = Number(p.p_amount);
      if (title.length < 1 || title.length > 80 || !(amount >= 1 && amount <= 100000) || !GOAL_ICONS.includes(String(p.p_icon)) || p.p_recurrence !== null) return reply(400, { message: 'invalid savings goal' });
      goalId = randomUUID();
      (db.savings_goals ??= []).push({ id: goalId, kid_user_id: prompt.learner_id, title, target: amount, icon: p.p_icon, status: 'active', created_at: new Date().toISOString(), reached_at: null });
    } else {
      const amount = Number(p.p_amount);
      if (title.length < 1 || title.length > 120 || !(amount >= 1 && amount <= 500) || !['once', 'weekly'].includes(String(p.p_recurrence)) || p.p_icon !== null) return reply(400, { message: 'invalid task' });
      taskId = randomUUID();
      (db.tasks ??= []).push({ id: taskId, assigned_by: p.p_actor_id, assigned_to: prompt.learner_id, title, reward_coins: amount, recurrence: p.p_recurrence, due_at: null, requires_evidence: false, status: 'open' });
    }
    // The table's CHECKs: a task or goal only for an acted guardian prompt of the matching action.
    if (taskId && !(prompt.action === 'earning_task' && prompt.audience === 'guardian')) return reply(400, { message: 'learning_bridge_prompts_task_guardian' });
    if (goalId && !(prompt.action === 'savings_goal' && prompt.audience === 'guardian')) return reply(400, { message: 'learning_bridge_prompts_goal_guardian' });
    Object.assign(prompt, { status: 'acted', closed_at: new Date().toISOString(), closed_by: p.p_actor_id, result_task_id: taskId, result_goal_id: goalId });
    return reply(200, { status: 'acted', replayed: false, task_id: taskId, goal_id: goalId });
  }) as typeof fetch;
}
